const { minify } = require('terser');

module.exports = function terserPlugin(options = {}) {
    return {
        name: 'terser',

        renderChunk(code) {
            const result = minify(code, Object.assign({}, options));
            if (result.error) {
                throw result.error;
            }
            return result;
        },
    };
};
