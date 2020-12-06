const rollupUtils = require('@rollup/pluginutils');
const { transform } = require('esbuild');
const babel = require('@babel/core');

const UMD_EXPORTS_KEYWORD = /\btypeof\s*exports/;
const UMD_DEFINE_KEYWORD = /\btypeof\s*define/;
const CJS_KEYWORDS = /\b(module\.exports|exports)\b/;
const ESM_KEYWORDS = /(\bimport\s*(\{|\s['"\w_$])|[\s;]export(\s+(default|const|var|let|function|\{})[^\w$]|\s*\{))/;

module.exports = function(options = {}) {
    options = Object.assign({}, options);
    const filter = rollupUtils.createFilter(
        options.include || ['**/*.{js,mjs,jsx,ts,tsx}'],
        options.exclude || [/node_modules\/@babel\/runtime\/helpers/],
    );

    delete options.include;
    delete options.exclude;

    const { minify, sourceMap, target, legacy, coverage, pragma, pragmaFrag, pragmaImport, pragmaDefault } = options;

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

            if (UMD_EXPORTS_KEYWORD.test(code) && UMD_DEFINE_KEYWORD.test(code)) {
                return null;
            }

            let isCommonJSModule = !ESM_KEYWORDS.test(code) && CJS_KEYWORDS.test(code);
            return await babel.transformAsync(code, {
                babelrc: false,
                compact: false,
                filename: id,
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
                    [require('@babel/plugin-transform-typescript'), {
                        isTSX: true,
                    }],
                    require('babel-plugin-transform-inline-environment-variables'),
                    (legacy || coverage) && require('../babel-plugin-transform-typeof-symbol/babel-plugin-transform-typeof-symbol'),
                    (legacy || coverage) && [require('@babel/plugin-transform-runtime'), {
                        corejs: false,
                        helpers: true,
                        regenerator: true,
                        useESModules: !isCommonJSModule,
                    }],
                    [require('@babel/plugin-proposal-decorators'), {
                        decoratorsBeforeExport: true,
                    }],
                    require('@babel/plugin-proposal-class-properties'),
                    require('@babel/plugin-proposal-private-methods'),
                    require('@babel/plugin-proposal-nullish-coalescing-operator'),
                    require('@babel/plugin-proposal-optional-chaining'),
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
            });
        },

        async renderChunk(code, chunk) {
            if (minify) {
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
