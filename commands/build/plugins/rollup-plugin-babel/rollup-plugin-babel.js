const path = require('path');
const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');

const BABEL_HELPERS = '\0rollupPluginBabelHelpers';
const CJS_MODULES = {};

function helperPlugin() {
    return {
        pre(file) {
            const cachedHelpers = {};
            file.set('helperGenerator', (name) => {
                if (cachedHelpers[name]) {
                    return cachedHelpers[name];
                }
                return (cachedHelpers[name] = babelModuleImports.addNamed(file.path, name, BABEL_HELPERS));
            });
        },
    };
}

function createScope(id) {
    return `\0${id}.scoped`;
}

function createAlias(id) {
    return `\0${id}.common`;
}

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(options.include || ['**/*.{js,mjs,jsx}'], options.exclude || []);
    const filterPolyfills = rollupUtils.createFilter([
        '**/node_modules/core-js/**/*',
        '**/node_modules/regenerator-runtime/**/*',
    ], []);

    delete options.include;
    delete options.exclude;

    let lastImporter;

    return {
        name: 'babel',

        resolveId(id, importer) {
            if (id === BABEL_HELPERS) return id;

            let filename = id;
            if (importer) {
                filename = path.resolve(path.dirname(importer), id);
                if (!path.extname(id)) {
                    filename += '.js';
                }
            }

            lastImporter = importer;

            for (let cid in CJS_MODULES) {
                let node = CJS_MODULES[cid];
                if (node.importer !== importer) {
                    if (cid === filename) {
                        return CJS_MODULES[cid].alias;
                    }
                    if (CJS_MODULES[cid].scope === id) {
                        return id;
                    }
                }
            }
        },

        load(id) {
            if (id === BABEL_HELPERS) {
                return babelCore.buildExternalHelpers(null, 'module');
            }

            for (let cid in CJS_MODULES) {
                if (CJS_MODULES[cid].alias === id) {
                    return `import Mod from '${CJS_MODULES[cid].scope}'; export default Mod.exports;`;
                }
                if (CJS_MODULES[cid].scope === id) {
                    return 'const module = { exports: {} }; export default module;';
                }
            }

            return;
        },

        transform(code, id) {
            if (!filter(id)) return null;
            if (id === BABEL_HELPERS) return null;

            for (let cid in CJS_MODULES) {
                if (CJS_MODULES[cid].alias === id) {
                    return {
                        code,
                        map: {},
                    };
                }
            }

            const extraPlugins = [
                helperPlugin,
                [require('../babel-plugin-transform-commonjs/babel-plugin-transform-commonjs.js'), {
                    scope: (program) => createScope(program.hub.file.opts.filename),
                }],
            ];

            let localOpts = Object.assign({
                filename: id,
            }, options, {
                ast: true,
                sourceMap: true,
                plugins: (options.plugins || []).concat(extraPlugins),
            });

            if (filterPolyfills(id)) {
                localOpts = Object.assign({}, localOpts, {
                    presets: [],
                });
            }

            const transformed = babelCore.transform(code, localOpts);
            const body = transformed.ast.program.body;
            for (let child of body) {
                if (child.__scope) {
                    CJS_MODULES[id] = CJS_MODULES[id] || {
                        id,
                        scope: createScope(id),
                        alias: createAlias(id),
                        importer: lastImporter,
                    };
                    break;
                }
            }

            return {
                code: transformed.code,
                // ast: transformed.ast.program,
                map: transformed.map,
            };
        },
    };
};
