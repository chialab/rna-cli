const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');

module.exports = postcss.plugin('postcss-copy-plugin', (opts = {}) => {
    let defaultHandler;
    if (opts.dest) {
        defaultHandler = (file, url, importee) => {
            if (!file || !fs.existsSync(file)) {
                return;
            }
            let relative = opts.basePath ? path.relative(opts.basePath, file) : path.relative(importee, file);
            let distFile = path.join(opts.dest, relative);
            if (distFile !== file) {
                fs.copySync(file, distFile);
            }
            return relative;
        };
    }
    return async (root) => {
        const promises = [];
        root.walkDecls((decl) => {
            if (decl.value && decl.value.indexOf('url(') > -1) {
                const urls = decl.value.match(/url\(['"]?.*?['"]?\)/ig).map((entry) => entry.replace(/^url\(['"]?/i, '').replace(/['"]?\)$/i, ''));
                const importee = decl.source.input && decl.source.input.file;
                if (!importee && !opts.basePath) {
                    return;
                }
                const map = decl.source.input.map;
                promises.push(
                    ...urls.map(async (url) => {
                        let res;
                        let file;
                        let mapImportee;
                        if (url.indexOf('data:') === 0) {
                            return;
                        }
                        if (map) {
                            let position = map.consumer().originalPositionFor(decl.source.start);
                            if (position && position.source) {
                                let resolved = path.resolve(path.dirname(importee), position.source);
                                if (fs.existsSync(resolved)) {
                                    mapImportee = resolved;
                                }
                            }
                        }
                        if (importee) {
                            file = path.resolve(path.dirname(importee), url.split('?')[0]);
                        }
                        if (opts.basePath && (!file || !fs.existsSync(file))) {
                            file = path.resolve(opts.basePath, url.split('?')[0]);
                        }
                        if (mapImportee && (!file || !fs.existsSync(file))) {
                            file = path.resolve(path.dirname(mapImportee), url.split('?')[0]);
                        }
                        if (opts.handleCSSAsset) {
                            res = opts.handleCSSAsset(file, url, decl);
                            if (res instanceof Promise) {
                                res = await res;
                            }
                        }
                        if (!res && defaultHandler) {
                            res = defaultHandler(file, url, decl);
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

        const replacements = await Promise.all(promises);
        replacements.forEach((info) => {
            let { decl, url, replace } = (info || {});
            if (replace) {
                decl.value = decl.value.replace(url, replace);
            }
        });
    };
});
