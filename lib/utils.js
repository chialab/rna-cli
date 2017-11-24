const UTILS = {
    /**
     * Return a randomly chosen element off an array.
     *
     * @param {Array<T>} arr Array of elements.
     * @return {T}
     */
    extractRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    /**
     * Convert a string to CamelCase.
     *
     * @param {string} str String.
     * @returns {string}
     */
    camelize(str) {
        return str.split('/').pop().replace(/(^[a-z0-9]|[-_]([a-z0-9]))/g, (g) => (g[1] || g[0]).toUpperCase());
    },

    /**
     * Left-pad a string to a desired length with whitespaces.
     *
     * @param {string} name String to be padded.
     * @param {integer} space Desired length.
     * @returns {string}
     */
    leftPad(str, space) {
        let prefix = '';
        while (space--) {
            prefix = ` ${prefix}`;
        }
        return str.replace(/^/m, prefix);
    },

    /**
     * Right-pad a string to a desired length with whitespaces.
     *
     * @param {string} name String to be padded.
     * @param {integer} space Desired length.
     * @returns {string}
     */
    rightPad(str, space) {
        let suffix = '';
        while (space--) {
            suffix += ' ';
        }
        return str.replace(/$/m, suffix);
    },
};

module.exports = UTILS;
