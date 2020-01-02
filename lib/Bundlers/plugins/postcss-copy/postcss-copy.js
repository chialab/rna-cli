const { existsSync, promises: { copyFile } } = require('fs');
const path = require('path');
const postcss = require('postcss');

function createDefaultHandler(opts) {
    if (!opts.dest) {
        return null;
    }
    return async (file) => {
        const fileName = path.basename(file);
        const distFile = path.join(opts.dest, fileName);
        if (distFile !== file) {
            await copyFile(file, distFile);
        }
        return fileName;
    };
}

function createDefaultResolver(opts) {
    return async (url, decl) => {
        if (url.indexOf('data:') === 0) {
            return null;
        }
        const importee = decl.source.input && decl.source.input.file;
        const map = decl.source.input && decl.source.input.map;
        if (!importee && !opts.basePath) {
            return null;
        }
        const mapImportee = map && (() => {
            let position = map.consumer().originalPositionFor(decl.source.start);
            if (position && position.source) {
                let resolved = path.resolve(opts.dest, position.source);
                if (existsSync(resolved)) {
                    return resolved;
                }
            }
        })();
        let file;
        if (importee) {
            file = path.resolve(path.dirname(importee), url.split('?')[0]);
        }
        if (opts.basePath && (!file || !existsSync(file))) {
            file = path.resolve(opts.basePath, url.split('?')[0]);
        }
        if (mapImportee && (!file || !existsSync(file))) {
            file = path.resolve(path.dirname(mapImportee), url.split('?')[0]);
        }
        if (!existsSync(file)) {
            return null;
        }
        return file;
    };
}

module.exports = postcss.plugin('postcss-copy-plugin', (opts = {}) => {
    const handler = opts.handler || createDefaultHandler(opts);
    const resolver = opts.resolver || createDefaultResolver(opts);
    const cache = {};

    return async (root, result) => {
        const promises = [];
        root.walkDecls((decl) => {
            if (decl.value && decl.value.indexOf('url(') > -1) {
                const urls = decl.value.match(/url\(['"]?.*?['"]?\)/ig)
                    .map((entry) => entry.replace(/^url\(['"]?/i, '').replace(/['"]?\)$/i, ''))
                    .filter(Boolean);
                const importee = decl.source.input && decl.source.input.file;
                if (!importee && !opts.basePath) {
                    return;
                }
                promises.push(
                    ...urls.map(async (url) => {
                        const file = await resolver(url, decl);
                        let replace;
                        if (!file) {
                            result.missingFiles = result.missingFiles || [];
                            result.missingFiles.push(file);
                        } else if (cache[file]) {
                            replace = cache[file];
                            if (replace) {
                                result.files = result.files || [];
                                if (result.files.indexOf(replace) === -1) {
                                    result.files.push(replace);
                                }
                            }
                        } else if (handler) {
                            replace = await handler(file);
                            if (replace) {
                                result.files = result.files || [];
                                if (result.files.indexOf(replace) === -1) {
                                    result.files.push(replace);
                                }
                            }
                            cache[file] = replace;
                        }
                        return {
                            url,
                            replace,
                            decl,
                        };
                    })
                );
            }
        });

        const replacements = await Promise.all(promises);
        replacements.forEach((info) => {
            const { decl, url, replace } = info;
            if (replace) {
                decl.value = decl.value.replace(url, replace);
            }
        });
    };
});
