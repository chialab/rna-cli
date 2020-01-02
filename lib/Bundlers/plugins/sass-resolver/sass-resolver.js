const path = require('path');
const resolve = require('resolve');

/**
 * List of style extensions.
 * - css
 * - sass
 * - scss
 * @type {Array<string>}
 */
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass'];

/**
 * Generate a list of file paths with all style extensions.
 * @param {string} url
 * @return {Array<string>}
 */
function alternatives(url) {
    let res = path.extname(url) ?
        // url already has an extension.
        [url] :
        // remap the path with all style extensions.
        STYLE_EXTENSIONS.map((ext) => `${url}${ext}`);
    // look for sass partials too.
    if (path.basename(url)[0] !== '_') {
        for (let i = 0, len = res.length; i < len; i++) {
            res.push(
                // add the _ for partial syntax
                path.join(
                    path.dirname(res[i]),
                    `_${path.basename(res[i])}`
                )
            );
        }
    }
    return res;
}

/**
 * @typedef {Object} ImporterResult
 * @property {string} [file] The url of the path to import.
 * @property {string} [contents] The contents of the file to import.
 */

/**
 * Create a scoped SASS resolver.
 */
module.exports = function() {
    const resolved = [];
    /**
     * Resolve the file path of an imported style.
     * @param {string} url The url to import.
     * @param {string} prev The url of the parent file.
     * @return {ImporterResult} The result of the import.
     */
    return function nodeResolver(url, prev) {
        if (url.match(/^(~|package:)/)) {
            // some modules use ~ or package: for node_modules import
            url = url.replace(/^(~|package:)/, '');
        }
        // generate alternatives for style starting from the module path
        // add package json check for `style` field.
        let toCheck;
        let splitted = url.split('/');
        if (splitted.length === 1) {
            toCheck = [url];
        } else if (url[0] === '@' && splitted.length === 2) {
            toCheck = [url];
        } else {
            toCheck = alternatives(url);
        }
        for (let i = 0, len = toCheck.length; i < len; i++) {
            let modCheck = toCheck[i];
            try {
                // use node resolution to get the full file path
                // it throws if the file does not exist.
                url = resolve.sync(modCheck, {
                    basedir: prev,
                    packageFilter(pkg) {
                        pkg.main = pkg.style;
                        return pkg;
                    },
                });
                if (url) {
                    // file found, stop the search.
                    break;
                }
            } catch (ex) {
                //
            }
        }
        if (resolved.indexOf(url) !== -1) {
            // This file has been resolved already.
            // Skip it in order to avoid duplications.
            return {
                contents: '',
            };
        }
        resolved.push(url);
        // return the found url.
        return {
            file: url,
        };
    };
};
