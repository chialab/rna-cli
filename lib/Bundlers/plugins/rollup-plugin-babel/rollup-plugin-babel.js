const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');

const BABEL_HELPERS = '\0rollupPluginBabelHelpers';

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
        },

        load(id) {
            if (id === BABEL_HELPERS) {
                return babelCore.buildExternalHelpers(null, 'module');
            }
            return;
        },

        transform(code, id) {
            if (!filter(id)) return null;
            if (id === BABEL_HELPERS) return null;

            let extraPlugins = [
                helperPlugin,
            ];

            let localOpts = Object.assign({
                filename: id,
            }, options, {
                ast: false,
                sourceMap: true,
                plugins: (options.plugins || []).concat(extraPlugins),
            });

            if (filterPolyfills(id)) {
                localOpts = Object.assign({}, localOpts, {
                    presets: [],
                });
            }

            return babelCore.transformAsync(code, localOpts);
        },
    };
};
