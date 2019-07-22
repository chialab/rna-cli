const { URL } = require('url');
const { getPolyfillString } = require('polyfill-library');

const POLYFILL_URL = '\0rollupPluginPolyfill';
const BODY = 'globalThis.polyfill = true;';

function polyfill() {
    const features = [];

    return {
        name: 'polyfill',

        options(config = {}) {
            config.manualChunks = config.manualChunks || {};
            config.manualChunks['polyfill'] = [POLYFILL_URL];
            return config;
        },

        async resolveId(importee) {
            if (importee === POLYFILL_URL) {
                return POLYFILL_URL;
            }
            try {
                let url = new URL(importee);
                if (url.host === 'cdn.polyfill.io') {
                    let params = (url.searchParams.get('features') || 'es6')
                        .split(',');
                    params.forEach((feat) => {
                        feat = feat.trim().toLowerCase();
                        if (!features.includes(feat)) {
                            features.push(feat);
                        }
                    });
                    return POLYFILL_URL;
                }
            } catch (err) {
                //
            }
            return null;
        },

        async load(id) {
            if (id === POLYFILL_URL) {
                return BODY;
            }
            return null;
        },

        async renderChunk(code, chunk) {
            if (chunk.name !== 'polyfill') {
                return null;
            }
            let polyfillCode = await getPolyfillString({
                features: features
                    .reduce((list, item) => {
                        list[item] = {};
                        return list;
                    }, {}),
            });
            let codeChunks = code.split(BODY);
            return {
                code: `${codeChunks[0]}${polyfillCode}${codeChunks[1]}`,
                map: {
                    mappings: '',
                },
            };
        },
    };
}

module.exports = polyfill;
