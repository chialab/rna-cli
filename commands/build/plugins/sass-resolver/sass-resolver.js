const fs = require('fs-extra');
const path = require('path');
const ext = require('../../../../lib/extensions.js');

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
        ext.STYLE_EXTENSIONS.map((ext) => `${url}${ext}`);
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

let tmpFiles;

/**
 * @typedef {Object} ImporterResult
 * @property {string} [file] The url of the path to import.
 * @property {string} [contents] The contents of the file to import.
 */

/**
 * Create a scoped SASS resolver.
 */
const resolver = module.exports = function() {
    tmpFiles = [];

    const alreadyResolved = [];
    /**
     * Resolve the file path of an imported style.
     * @param {string} url The url to import.
     * @param {string} prev The url of the parent file.
     * @return {ImporterResult} The result of the import.
     */
    return function nodeResolver(url, prev) {
        let mod;
        if (url.match(/^(~|package:)/)) {
            // some modules use ~ or package: for node_modules import
            mod = url.replace(/^(~|package:)/, '');
        } else {
            // generate file alternatives starting from the previous path
            let toCheck = alternatives(path.join(path.dirname(prev), url));
            // find out existing file
            let resolved = toCheck.find((f) => fs.existsSync(f));
            if (resolved) {
                // the local file exists, node resolution is not required
                url = resolved;
            } else {
                // if file is a module
                mod = url;
            }
        }
        if (mod) {
            // generate alternatives for style starting from the module path
            // add package json check for `style` field.
            let toCheck = alternatives(mod).concat([path.join(mod, 'package.json')]);
            for (let i = 0, len = toCheck.length; i < len; i++) {
                let modCheck = toCheck[i];
                try {
                    // use node resolution to get the full file path
                    // it throws if the file does not exist.
                    let checked = require.resolve(modCheck, {
                        paths: [path.dirname(prev) || process.cwd()],
                    });
                    if (path.extname(checked) === '.json') {
                        // package.json found
                        checked = fs.realpathSync(checked);
                        let json = require(checked);
                        if (json.style) {
                            // style field found.
                            url = path.join(path.dirname(checked), json.style);
                        } else if (json.main && ext.isStyleFile(json.main)) {
                            // try to use the main field if it is a css file.
                            url = path.join(path.dirname(checked), json.main);
                        }
                    } else {
                        // url found
                        url = checked;
                    }
                    if (url) {
                        // file found, stop the search.
                        break;
                    }
                } catch (ex) {
                    //
                }
            }
        }
        if (alreadyResolved.indexOf(url) !== -1) {
            // This file has been resolved already.
            // Skip it in order to avoid duplications.
            return {
                contents: '',
            };
        }
        alreadyResolved.push(url);
        if (path.extname(url) === '.css') {
            // if the file has css extension, return its contents.
            // (sass does not include css file using plain css import, so we have to pass the content).
            const sassUrl = path.join(path.dirname(url), `${path.basename(url, path.extname(url))}.scss`);
            fs.copySync(url, sassUrl);
            url = sassUrl;
            tmpFiles.push(sassUrl);
        }
        // return the found url.
        return {
            file: url,
        };
    };
};

/**
 * Remove temporary files.
 * @return {void}
 */
resolver.clear = function() {
    if (tmpFiles) {
        tmpFiles.forEach((tmp) => {
            fs.removeSync(tmp);
        });
        tmpFiles = [];
    }
};
