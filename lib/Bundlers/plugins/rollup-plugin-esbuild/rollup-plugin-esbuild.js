const rollupUtils = require('@rollup/pluginutils');
const { transform } = require('esbuild');
const babel = require('@babel/core');

const CJS_KEYWORDS = /\b(module\.exports|exports)\b/;
const ESM_KEYWORDS = /(\bimport\s*(\{|\s['"\w_$])|[\s;]export(\s+(default|const|var|let|function|\{})[^\w$]|\s*\{))/;

function getEnvVariables() {
    let result = {};
    for (let key in process.env) {
        result[`process.env.${key}`] = `${JSON.stringify(process.env[key])}`;
    }
    return result;
}

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(
        options.include || ['**/*.{js,mjs,jsx,ts,tsx}'],
        options.exclude || [/node_modules\/@babel\/runtime\/helpers/],
    );

    delete options.include;
    delete options.exclude;

    const { production, sourceMap, target, legacy, coverage, pragma, pragmaFrag, pragmaImport, pragmaDefault } = options;

    let jsxEntries = [];
    if (pragma) {
        jsxEntries.push(pragma.split(/[.[]/)[0]);
    }
    if (pragmaFrag) {
        jsxEntries.push(pragmaFrag.split(/[.[]/)[0]);
    }

    return {
        name: 'esbuild',

        resolveId(id) {
            if (id.startsWith('@babel/runtime')) {
                return require.resolve(id);
            }

            return;
        },

        async transform(code, id) {
            if (!filter(id)) {
                return null;
            }

            let isCommonJSModule = !ESM_KEYWORDS.test(code) && CJS_KEYWORDS.test(code);
            let buildOptions = {
                target: 'es2019',
                sourcefile: id,
                sourcemap: sourceMap !== false,
                loader: 'tsx',
                define: {
                    'process.env.NODE_ENV': production ? '\'production\'' : '\'development\'',
                    ...getEnvVariables(),
                },
            };

            if (pragma) {
                buildOptions.jsxFactory = pragma;
            }
            if (pragmaFrag) {
                buildOptions.jsxFragment = pragmaFrag;
            }

            if (jsxEntries.length && pragmaImport) {
                if (pragmaDefault) {
                    code = `${code}\nimport ${jsxEntries[0]} from '${pragmaImport}';`;
                } else {
                    code = `${code}\nimport { ${jsxEntries.join(', ')} } from '${pragmaImport}';`;
                }
            }

            let result = await transform(code, buildOptions);
            if (!result.map) {
                return code;
            }

            if (production || legacy || coverage) {
                result = await babel.transformAsync(result.code, Object.assign({
                    babelrc: false,
                    compact: false,
                    filename: id,
                    inputSourceMap: coverage && JSON.parse(result.map),
                    ast: false,
                    sourceMaps: true,
                    presets: [
                        (legacy || coverage) && [require('@babel/preset-env'), {
                            targets: target,
                            corejs: {
                                version: 3,
                                proposals: true,
                            },
                            bugfixes: true,
                            shippedProposals: true,
                            useBuiltIns: 'entry',
                            modules: false,
                            exclude: [
                                '@babel/plugin-transform-typeof-symbol',
                            ],
                        }],
                    ].filter(Boolean),
                    plugins: [
                        require('@babel/plugin-syntax-dynamic-import'),
                        require('@babel/plugin-syntax-import-meta'),
                        (legacy || coverage) && require('../babel-plugin-transform-typeof-symbol/babel-plugin-transform-typeof-symbol'),
                        (legacy || coverage) && [require('@babel/plugin-transform-runtime'), {
                            corejs: false,
                            helpers: true,
                            regenerator: true,
                            useESModules: !isCommonJSModule,
                        }],
                        isCommonJSModule && require('@babel/plugin-transform-modules-commonjs'),
                        production && pragma && [require('babel-plugin-htm'), {
                            pragma,
                        }],
                        legacy && require('../babel-plugin-dynamic-to-static/babel-plugin-dynamic-to-static'),
                        coverage && [require('babel-plugin-istanbul'), {
                            include: [],
                            exclude: [
                                '**/test/**',
                                '**/node_modules/**',
                            ],
                            useInlineSourceMaps: true,
                        }],
                    ].filter(Boolean),
                }));
            }

            return result;
        },

        async renderChunk(code, chunk) {
            if (production) {
                return await transform(code, {
                    sourcefile: chunk.fileName,
                    sourcemap: sourceMap !== false,
                    loader: 'ts',
                    minify: true,
                });
            }
        },
    };
};
