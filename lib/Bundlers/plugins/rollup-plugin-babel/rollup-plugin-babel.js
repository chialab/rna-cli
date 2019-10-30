const rollupUtils = require('rollup-pluginutils');
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

        async transform(code, id) {
            if (!filter(id)) return null;

            try {
                const ast = await babel.parseAsync(code, {
                    parserOpts: {
                        sourceType: 'script',
                        ecmaVersion: 5,
                    },
                });
                return await babel.transformFromAstAsync(ast, code, {
                    filename: id,
                    ast: false,
                    babelrc: false,
                    compact: false,
                    sourceMap: true,
                    plugins: [
                        [require('@chialab/babel-preset/plugins/babel-plugin-transform-commonjs/babel-plugin-transform-commonjs'), {
                            cache: options.transformCommonjsCache,
                        }],
                    ],
                    parserOpts: {
                        sourceType: 'module',
                        ecmaVersion: 5,
                        plugins: ['estree'],
                    },
                });
            } catch(err) {
                //
            }

            const transformOptions = Object.assign({
                filename: id,
            }, options, {
                ast: false,
                sourceMap: true,
                presets: options.presets || [],
                plugins: options.plugins || [],
            });
            return babel.transformAsync(code, transformOptions);
        },
    };
};
