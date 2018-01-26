const path = require('path');

/**
 * List of javascript extensions.
 * - javascript
 * - jsx
 * - javascript module
 * - typescript
 * @type {Array<string>}
 */
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.ts'];

/**
 * List of style extensions.
 * - css
 * - sass
 * @type {Array<string>}
 */
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass'];

/**
 * Check if file is a javascript file.
 * @param {string} file The file to check.
 * @return {Boolean}
 */
function isJSFile(file) {
    return JS_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a style file.
 * @param {string} file The file to check.
 * @return {Boolean}
 */
function isStyleFile(file) {
    return STYLE_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

module.exports = {
    JS_EXTENSIONS,
    STYLE_EXTENSIONS,
    isJSFile,
    isStyleFile,
};
