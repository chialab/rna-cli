const fs = require('fs');
const path = require('path');

/**
 * Ensure a directory exists. This function is **NOT** recursive.
 *
 * @param {string} dir Directory path.
 * @returns {void}
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

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
     * Ensure a directory exists. Equivalent of `mkdir -p <dir>`.
     *
     * @param {string} dir Directory path.
     * @returns {void}
     */
    ensureDir(dir) {
        let fullDir;
        let split = dir.split(path.sep);
        split.forEach((chunk, index) => {
            if (chunk) {
                if (index < (split.length - 1) || !chunk.match(/\./)) {
                    if (fullDir) {
                        fullDir = path.join(fullDir, chunk);
                    } else {
                        fullDir = chunk;
                    }
                    ensureDir(fullDir);
                }
            } else {
                fullDir = '/';
            }
        });
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
};

module.exports = UTILS;
