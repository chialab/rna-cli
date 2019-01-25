const path = require('path');
const postcss = require('postcss');
const sass = require('sass');

module.exports = postcss.plugin('postcss-dart-sass-plugin', (opts) => {
    opts = opts || {};

    return async (root, result) => {
        let extname = path.extname(result.opts.from);
        if (extname !== '.scss' && extname !== '.sass') {
            return result;
        }
        let map = typeof result.opts.map === 'object' ? result.opts.map : {};
        let css = root.toResult(Object.assign(result.opts, {
            map: Object.assign({
                annotation: false,
                inline: false,
                sourcesContent: true,
            }, map),
        }));
        let options = Object.assign({
            includePaths: ['node_modules'],
            importer: require('../sass-resolver/sass-resolver')(),
            indentWidth: 4,
            omitSourceMapUrl: true,
            outputStyle: 'expanded',
            sourceMap: true,
            sourceMapContents: true,
        }, opts, {
            data: css.css,
            file: result.opts.from,
            outFile: result.opts.to,
        });
        let sassResult = sass.renderSync(options);
        let ast = await postcss.parse(sassResult.css.toString(), {
            from: result.opts.from,
            map: sassResult.map && {
                prev: JSON.parse(sassResult.map.toString()),
            },
        });
        ast.walkDecls((decl) => {
            if (decl.value && decl.value.indexOf('url(') > -1) {
                // correctly point url references
                let consumer = decl.source.input.map.consumerCache;
                let position = consumer.originalPositionFor(decl.source.start);
                if (position.source) {
                    // original file found for the rule
                    let clone = decl.clone();
                    clone.value = clone.value.replace(/url\(['"]?(.*?)['"]?\)/g, (full, url) => {
                        if (url.match(/^(\w+:|\/\/)/)) {
                            // ignore absolute and data urls
                            return full;
                        }
                        let sourcePath = path.resolve(path.dirname(result.opts.to), position.source);
                        let assetPath = path.resolve(path.dirname(sourcePath), url);
                        let relative = path.relative(path.dirname(result.opts.to), assetPath);
                        return full.replace(url, relative);
                    });
                    if (clone.value !== decl.value) {
                        // update the declaration
                        decl.replaceWith(clone);
                    }
                }
            }
        });
        result.root = ast;
        result.dependencies = sassResult.stats.includedFiles;
    };
});
