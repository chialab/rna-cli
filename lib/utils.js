const fs = require('fs-extra');
const path = require('path');
const gzipSize = require('gzip-size');
const paths = require('./paths.js');

/**
 * @typedef {Object} FileSize
 * @property {string} file The absolute file name.
 * @property {number} size The original size.
 * @property {number} zipped The gzipped size.
 */

const UTILS = {
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
     * Get the path relative to cwd.
     *
     * @param {string} file The absolute file path.
     * @return {string}
     */
    relativeToCwd(file) {
        return path.relative(paths.cwd, file);
    },

    /**
     * Get the file size (original and gzipped).
     *
     * @param {string} file The file to analyze.
     * @return {FileSize|Array<FileSize>}
     */
    size(file) {
        let stats = fs.statSync(file);
        if (stats.isDirectory()) {
            return fs.readdirSync(file)
                .map((child) => path.join(file, child))
                .filter((child) => fs.statSync(child).isFile())
                .map((child) => UTILS.size(child));
        }
        return {
            file,
            size: fs.statSync(file).size,
            zipped: gzipSize.fileSync(file),
        };
    },

    /**
     * Prettify byte size.
     *
     * @param {number} size The file size in bytes.
     * @return {string} The size with the correct unit.
     */
    prettyByte(size) {
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
