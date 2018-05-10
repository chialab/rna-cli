const path = require('path');
const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');

const BABEL_HELPERS = '\0rollupPluginBabelHelpers';
const CJS_MODULES = [];

function helperPlugin() {
    return {
        pre(file) {
            const cachedHelpers = {};
            file.set('helperGenerator', name => {
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

            for (let node of CJS_MODULES) {
                if (node.id === filename) {
                    return node.alias;
                }
                if (node.scope === id) {
                    return id;
                }
            }
        },

        load(id) {
            if (id === BABEL_HELPERS) {
                return babelCore.buildExternalHelpers(null, 'module');
            }

            for (let node of CJS_MODULES) {
                if (node.alias === id) {
                    return `import Mod from '${node.scope}'; export default Mod.exports;`;
                }
                if (node.scope === id) {
                    return 'const module = { exports: {} }; export default module;';
                }
            }

            return;
        },

        transform(code, id) {
            if (!filter(id)) return null;
            if (id === BABEL_HELPERS) return null;

            for (let node of CJS_MODULES) {
                if (node.alias === id) {
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
                sourceMap: true,
            }, options, {
                ast: true,
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
                    CJS_MODULES.push({
                        id,
                        scope: createScope(id),
                        alias: createAlias(id),
                    });
                    break;
                }
            }

            return {
                code: transformed.code,
                map: transformed.map,
            };
        },
    };
};
