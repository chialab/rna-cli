const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(
        options.include || [
            '**/*.{js,mjs,jsx}',
        ],
        options.exclude || [
            /node_modules\/@babel\/runtime\/helpers/,
        ],
    );

    delete options.include;
    delete options.exclude;

    return {
        name: 'babel',

        transform(code, id) {
            if (!filter(id)) return null;

            return babelCore.transformAsync(code, Object.assign({
                filename: id,
            }, options, {
                ast: false,
                sourceMap: true,
                presets: options.presets || [],
                plugins: options.plugins || [],
            }));
        },
    };
};
