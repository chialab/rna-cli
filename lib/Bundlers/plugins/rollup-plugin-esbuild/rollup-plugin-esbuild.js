const rollupUtils = require('@rollup/pluginutils');
const { transform } = require('esbuild');

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(
        options.include || ['**/*.{js,mjs,jsx,ts,tsx}'],
        options.exclude || [],
    );

    delete options.include;
    delete options.exclude;

    let jsxEntries = [];
    if (options.pragma) {
        jsxEntries.push(options.pragma.split(/[.[]/)[0]);
    }
    if (options.pragmaFrag) {
        jsxEntries.push(options.pragmaFrag.split(/[.[]/)[0]);
    }

    return {
        name: 'esbuild',

        async transform(code, id) {
            if (!filter(id)) {
                return null;
            }

            let buildOptions = {
                format: 'esm',
                target: options.target || 'es2017',
                sourcefile: id,
                sourcemap: options.sourceMap !== false,
                loader: 'tsx',
            };

            if (options.pragma) {
                buildOptions.jsxFactory = options.pragma;
            }
            if (options.pragmaFrag) {
                buildOptions.jsxFragment = options.pragmaFrag;
            }
            if (jsxEntries.length && options.pragmaImport) {
                if (options.pragmaDefault) {
                    code = `${code}\nimport ${jsxEntries[0]} from '${options.pragmaImport}';`;
                } else {
                    code = `${code}\nimport { ${jsxEntries.join(', ')} } from '${options.pragmaImport}';`;
                }
            }

            let result = await transform(code, buildOptions);
            if (!result.map) {
                return code;
            }

            return result;
        },

        async renderChunk(code, chunk) {
            if (options.minify) {
                return await transform(code, {
                    target: options.target || 'es2017',
                    sourcefile: chunk.fileName,
                    sourcemap: options.sourceMap !== false,
                    loader: 'ts',
                    minify: true,
                });
            }
        },
    };
};
