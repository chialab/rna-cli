const UTILS = {
    /**
     * Try to invoke garbage collection.
     */
    gc() {
        try {
            global.gc();
        } catch (err) {
            //
        }
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

    /**
     * Prettify byte size.
     *
     * @param {number} size The file size in bytes.
     * @return {string} The size with the correct unit.
     */
    prettyBytes(size) {
        size = Math.abs(size);

        const KILO = 1024;
        const MEGA = KILO ** 2;
        const TERA = KILO ** 3;

        if (size > TERA) {
            return `${(size / TERA).toFixed(1)} TB`;
        } else if (size > MEGA) {
            return `${(size / MEGA).toFixed(1)} MB`;
        } else if (size > KILO) {
            return `${(size / KILO).toFixed(1)} KB`;
        }
        return `${size} B`;
    },
};

module.exports = UTILS;
