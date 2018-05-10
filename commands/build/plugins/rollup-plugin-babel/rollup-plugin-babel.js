const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');

const BABEL_HELPERS = 'rollupPluginBabelHelpers';
const CJS_MODULES = {};

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

        resolveId(id) {
            if (id === BABEL_HELPERS) return id;
            if (id in CJS_MODULES) return id;
        },

        load(id) {
            if (id === BABEL_HELPERS) {
                return babelCore.buildExternalHelpers(null, 'module');
            }

            if (id in CJS_MODULES) {
                return '';
            }

            return;
        },

        transform(code, id) {
            if (id in CJS_MODULES) {
                return CJS_MODULES[id];
            }
            if (!filter(id)) return null;
            if (id === BABEL_HELPERS) return null;

            let localOpts = Object.assign({
                filename: id,
                sourceMap: true,
            }, options, {
                ast: true,
                plugins: (options.plugins || []).concat([helperPlugin]),
            });

            if (filterPolyfills(id)) {
                localOpts = Object.assign({}, localOpts, {
                    presets: [],
                });
            }

            const transformed = babelCore.transform(code, localOpts);

            if (code.match(/\b(?:module|exports)\b/) && !(id in CJS_MODULES)) {
                id = `${id}.commonjs`;
                CJS_MODULES[id] = {
                    code: transformed.code,
                    map: transformed.map,
                };
                const body = transformed.ast.program.body;
                let result = `export * from '${id}';`;
                if (body.find((node) => node.type === 'ExportDefaultDeclaration')) {
                    result += `\nimport Mod from '${id}';`;
                    result += '\nexport default Mod;';
                }
                return {
                    code: result,
                };
            }

            return {
                code: transformed.code,
                map: transformed.map,
            };
        },
    };
};
