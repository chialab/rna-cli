const { URL } = require('url');
const { getPolyfillString } = require('polyfill-library');

const POLYFILL_URL = '\0rollupPluginPolyfill';

function polyfill() {
    return {
        name: 'polyfill',

        async resolveId(importee) {
            if (importee.indexOf('https://cdn.polyfill.io') === 0) {
                return `${POLYFILL_URL}?${importee}`;
            }
            return null;
        },

        async load(id) {
            if (id.indexOf(POLYFILL_URL) === 0) {
                let url = new URL(id.substring(POLYFILL_URL.length + 1, id.length));
                let features = url.searchParams.get('features') || 'es6';
                let code = await getPolyfillString({
                    features: features
                        .split(',')
                        .reduce((list, item) => {
                            list[item] = {};
                            return list;
                        }, {}),
                });
                return code;
            }
            return null;
        },
    };
}

module.exports = polyfill;
