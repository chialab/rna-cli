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

function deleteFolderRecursive(p) {
    if (fs.existsSync(p)) {
        fs.readdirSync(p).forEach((file) => {
            let curPath = path.join(p, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(p);
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
     * Empty directory.
     *
     * @param {string} dir Directory path.
     * @returns {void}
     */
    emptyDir(dir) {
        deleteFolderRecursive(dir);
        UTILS.ensureDir(dir);
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
