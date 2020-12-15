const rollupUtils = require('@rollup/pluginutils');
const { transform } = require('esbuild');
const babel = require('@babel/core');

const UMD_EXPORTS_KEYWORD = /\btypeof\s*(exports|module)/;
const UMD_DEFINE_KEYWORD = /\btypeof\s*define/;
const CJS_KEYWORDS = /\b(module\.exports|exports)\b/;
const ESM_KEYWORDS = /(\bimport\s*(\{|\s['"\w_$])|[\s;]export(\s+(default|const|var|let|function|\{})[^\w$]|\s*\{))/;

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(
        options.include || ['**/*.{js,mjs,jsx,ts,tsx}'],
        options.exclude || [
            /@babel\/runtime\/helpers/,
            /core-js/,
        ],
    );

    delete options.include;
    delete options.exclude;

    const { production, format, sourcemap, targets, coverage, pragma, pragmaFrag, pragmaImport, pragmaDefault } = options;

    return {
        name: 'tsx',

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

            if (UMD_EXPORTS_KEYWORD.test(code) && UMD_DEFINE_KEYWORD.test(code)) {
                return null;
            }

            let isCommonJSModule = !ESM_KEYWORDS.test(code) && CJS_KEYWORDS.test(code);
            let result = await babel.transformAsync(code, {
                babelrc: false,
                compact: false,
                filename: id,
                ast: false,
                sourceMaps: !!sourcemap,
                presets: [
                    [require('@babel/preset-env'), {
                        targets,
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
                ],
                plugins: [
                    require('@babel/plugin-syntax-import-meta'),
                    id.match(/\.tsx?$/) && [require('@babel/plugin-transform-typescript'), {
                        isTSX: true,
                    }],
                    require('babel-plugin-transform-inline-environment-variables'),
                    require('../babel-plugin-transform-typeof-symbol/babel-plugin-transform-typeof-symbol'),
                    [require('@babel/plugin-transform-runtime'), {
                        corejs: false,
                        helpers: true,
                        regenerator: true,
                        useESModules: !isCommonJSModule,
                    }],
                    [require('@babel/plugin-proposal-decorators'), {
                        decoratorsBeforeExport: true,
                    }],
                    isCommonJSModule && require('@babel/plugin-transform-modules-commonjs'),
                    pragma && require('../babel-plugin-jsx-template/babel-plugin-jsx-template'),
                    pragma && [require('../babel-plugin-jsx/babel-plugin-jsx'), {
                        pragma,
                        pragmaFrag,
                        import: pragmaImport,
                        pragmaDefault,
                    }],
                    pragma && [require('babel-plugin-htm'), {
                        pragma,
                        import: pragmaImport,
                        pragmaDefault,
                    }],
                    (format === 'umd' || format === 'iife') && require('../babel-plugin-dynamic-to-static/babel-plugin-dynamic-to-static'),
                    coverage && [require('babel-plugin-istanbul'), {
                        include: [],
                        exclude: [
                            '**/test/**',
                            '**/node_modules/**',
                        ],
                        useInlineSourceMaps: true,
                    }],
                ].filter(Boolean),
            });

            return result;
        },

        async renderChunk(code, chunk) {
            if (production) {
                let banner = '';
                let facade = chunk.facadeModuleId;
                let info = this.getModuleInfo(facade);
                if (info) {
                    this.parse(info.code, {
                        onComment(block, text) {
                            if (block && text.match(/@license/)) {
                                banner += `/*${text}*/`;
                            }
                        },
                    });
                }
                return await transform(code, {
                    sourcefile: chunk.fileName,
                    sourcemap: !!sourcemap,
                    loader: 'ts',
                    minify: true,
                    banner,
                });
            }
        },
    };
};
