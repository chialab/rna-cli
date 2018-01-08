const rollupUtils = require('rollup-pluginutils');
const acorn = require('acorn');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');

const HELPERS = 'rollupPluginBabelHelpers';

function helperPlugin() {
    return {
        pre(file) {
            const cachedHelpers = {};
            file.set('helperGenerator', name => {
                if (cachedHelpers[name]) {
                    return cachedHelpers[name];
                }
                return (cachedHelpers[name] = babelModuleImports.addNamed(file.path, name, HELPERS));
            });
        },
    };
}

module.exports = function(options = {}) {
    options = Object.assign({}, options);

    const filter = rollupUtils.createFilter(options.include, options.exclude);
    delete options.include;
    delete options.exclude;

    return {
        name: 'babel',

        resolveId(id) {
            if (id === HELPERS) return id;
        },

        load(id) {
            if (id !== HELPERS) {
                return;
            }

            return babelCore.buildExternalHelpers(null, 'module');
        },

        transform(code, id) {
            if (!filter(id)) return null;
            if (id === HELPERS) return null;
            try {
                if (~code.indexOf('process.env')) {
                    throw new Error();
                }
                acorn.parse(code, {
                    sourceType: 'module',
                    ecmaVersion: 5,
                });
                return null;
            } catch (err) {
                let localOpts = Object.assign({
                    filename: id,
                    sourceMap: true,
                }, options);

                localOpts = Object.assign({}, localOpts, {
                    plugins: (localOpts.plugins || []).concat(helperPlugin),
                });

                const transformed = babelCore.transform(code, localOpts);

                return {
                    code: transformed.code,
                    map: transformed.map,
                };
            }
        },
    };
};
