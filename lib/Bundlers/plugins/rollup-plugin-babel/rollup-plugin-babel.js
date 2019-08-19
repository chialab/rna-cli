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
    const cache = options.cache;
    const filter = rollupUtils.createFilter(options.include || ['**/*.{js,mjs,jsx}'], options.exclude || []);

    delete options.include;
    delete options.exclude;
    delete options.cache;

    return {
        name: 'babel',

        resolveId(importee) {
            if (importee === BABEL_HELPERS) {
                return importee;
            }

            if (importee.indexOf('core-js/') !== 0) {
                return null;
            }

            try {
                return require('resolve').sync(importee, {
                    basedir: __dirname,
                });
            } catch (err) {
                //
            }

            return null;
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
                [require('@chialab/babel-preset/plugins/babel-plugin-transform-commonjs/babel-plugin-transform-commonjs'), {
                    cache,
                }],
                helperPlugin,
            ];
            let presets = options.presets || [];
            let plugins = options.plugins || [];
            if (id.indexOf('node_modules/core-js') !== -1) {
                presets = [];
                plugins = [];
            }

            let localOpts = Object.assign({
                filename: id,
            }, options, {
                ast: false,
                sourceMap: true,
                presets,
                plugins: plugins.concat(extraPlugins),
            });

            return babelCore.transformAsync(code, localOpts);
        },
    };
};
