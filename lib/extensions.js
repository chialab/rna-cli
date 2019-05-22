const path = require('path');

/**
 * List of javascript extensions.
 * - javascript
 * - jsx
 * - javascript module
 * - typescript
 * @type {Array<string>}
 */
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];

/**
 * List of style extensions.
 * - css
 * - sass
 * - scss
 * @type {Array<string>}
 */
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass'];

/**
 * List of HTML extensions.
 * - html
 * - htm
 * @type {Array<string>}
 */
const HTML_EXTENSIONS = ['.html', '.htm'];

/**
 * List of WebManifest extensions.
 * - webmanifest
 * @type {Array<string>}
 */
const WEBMANIFEST_EXTENSIONS = ['.webmanifest'];

/**
 * Check if file is a javascript file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isJSFile(file) {
    return JS_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a style file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isStyleFile(file) {
    return STYLE_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a HTML file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isHTMLFile(file) {
    return HTML_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a webmanifest file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isWebManifestFile(file) {
    return WEBMANIFEST_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

module.exports = {
    JS_EXTENSIONS,
    STYLE_EXTENSIONS,
    HTML_EXTENSIONS,
    WEBMANIFEST_EXTENSIONS,
    isJSFile,
    isStyleFile,
    isHTMLFile,
    isWebManifestFile,
};
