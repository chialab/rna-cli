const rollupUtils = require('@rollup/pluginutils');
const babel = require('@babel/core');

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

        async transform(inputCode, id) {
            if (!filter(id)) return null;

            const { code, map } = await babel.transformAsync(inputCode, Object.assign({
                filename: id,
            }, options, {
                ast: false,
                sourceMaps: true,
                inputSourceMap: true,
                presets: options.presets || [],
                plugins: options.plugins || [],
            }));

            return { code, map };
        },
    };
};
