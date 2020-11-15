const rollupUtils = require('@rollup/pluginutils');
const { transform } = require('esbuild');

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(
        options.include || [
            '**/*.{js,mjs,jsx}',
        ],
        options.exclude || [],
    );

    delete options.include;
    delete options.exclude;

    return {
        name: 'esbuild',

        async transform(code, id) {
            if (!filter(id)) {
                return null;
            }

            let result = await transform(code, {
                format: 'esm',
                target: options.target || 'es2017',
                sourcefile: id,
                sourcemap: options.sourceMap !== false,
                loader: 'tsx',
            });

            if (!result.map) {
                return code;
            }

            return result;
        },

        async renderChunk(code, chunk) {
            if (options.minify) {
                return await transform(code, {
                    format: 'esm',
                    target: options.target || 'es2017',
                    sourcefile: chunk.fileName,
                    sourcemap: options.sourceMap !== false,
                    loader: 'tsx',
                    minify: true,
                });
            }
        },
    };
};
