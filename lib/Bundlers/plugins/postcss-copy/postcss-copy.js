const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');

module.exports = postcss.plugin('postcss-copy-plugin', (opts = {}) => {
    let defaultHandler;
    if (opts.dest) {
        defaultHandler = (file, url, importee) => {
            if (!file || (opts.basePath && file.indexOf(opts.basePath) !== 0) || !fs.existsSync(file)) {
                return;
            }
            let relative = opts.basePath ? path.relative(opts.basePath, file) : path.relative(importee, file);
            let distFile = path.join(opts.dest, relative);
            fs.copySync(file, distFile);
            return relative;
        };
    }
    return async (root) => {
        let promises = [];
        root.walkDecls((decl) => {
            if (decl.value && decl.value.indexOf('url(') > -1) {
                let urls = decl.value.match(/url\(['"]?.*?['"]?\)/ig).map((entry) => entry.replace(/^url\(['"]?/i, '').replace(/['"]?\)$/i, ''));
                let importee = decl.source.input && decl.source.input.file;
                if (!importee && !opts.basePath) {
                    return;
                }
                promises.push(
                    ...urls.map(async (url) => {
                        let res;
                        let file;
                        if (importee) {
                            file = path.resolve(path.dirname(importee), url);
                        }
                        if (opts.basePath && (!file || fs.existsSync(file))) {
                            file = path.resolve(opts.basePath, url);
                        }
                        if (opts.handleCSSAsset) {
                            res = opts.handleCSSAsset(file, url, importee, decl);
                            if (res instanceof Promise) {
                                res = await res;
                            }
                        }
                        if (!res && defaultHandler) {
                            res = defaultHandler(file, url, importee, decl);
                            if (res instanceof Promise) {
                                res = await res;
                            }
                        }
                        return {
                            url,
                            replace: res,
                            decl,
                        };
                    })
                );
            }
        });

        let replacements = await Promise.all(promises);
        replacements.forEach(({ decl, url, replace }) => {
            if (replace) {
                decl.value = decl.value.replace(url, replace);
            }
        });
    };
});
