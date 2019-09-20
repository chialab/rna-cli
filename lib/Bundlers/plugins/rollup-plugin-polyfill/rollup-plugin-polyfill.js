const POLYFILLIO_URL = '\0rollupPluginPolyfillio';
const POLYFILLIO_BODY = 'globalThis.polyfill = true;';
const POLYFILLIO_CHUNK = 'polyfillio';

function polyfill(options = {}) {
    const { features = [] } = options;

    return {
        name: 'polyfill',

        options(config = {}) {
            if (!config.inlineDynamicImports) {
                config.manualChunks = config.manualChunks || {};
                config.manualChunks[POLYFILLIO_CHUNK] = [POLYFILLIO_URL];
            }
            return config;
        },

        async resolveId(importee) {
            if (importee === POLYFILLIO_URL) {
                return POLYFILLIO_URL;
            }

            try {
                const { URL } = require('url');
                const url = new URL(importee);
                if (url.host === 'cdn.polyfill.io') {
                    (url.searchParams.get('features') || 'es6')
                        .split(',')
                        .forEach((feat) => {
                            feat = feat.trim().toLowerCase();
                            if (!features.includes(feat)) {
                                features.push(feat);
                            }
                        });
                    return POLYFILLIO_URL;
                }
            } catch (err) {
                //
            }
            return null;
        },

        async load(id) {
            if (id === POLYFILLIO_URL) {
                return POLYFILLIO_BODY;
            }
            return null;
        },

        async renderChunk(code, chunk) {
            if (chunk.name === POLYFILLIO_CHUNK) {
                const { getPolyfillString } = require('polyfill-library');
                const polyfillCode = await getPolyfillString({
                    features: features
                        .reduce((list, item) => {
                            list[item] = {};
                            return list;
                        }, {}),
                });
                let codeChunks = code.split(POLYFILLIO_BODY);
                return {
                    code: `${codeChunks[0]}${polyfillCode}${codeChunks[1]}`,
                    map: {
                        mappings: '',
                    },
                };
            }

            return null;
        },
    };
}

module.exports = polyfill;
