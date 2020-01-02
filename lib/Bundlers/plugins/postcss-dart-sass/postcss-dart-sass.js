const { existsSync } = require('fs');
const path = require('path');
const postcss = require('postcss');
const sass = require('sass');

module.exports = postcss.plugin('postcss-dart-sass-plugin', (opts = {}) =>
    async (root, result) => {
        const extname = result.opts.from ? path.extname(result.opts.from) : null;
        if (extname !== '.scss' && extname !== '.sass') {
            return result;
        }
        const map = typeof result.opts.map === 'object' ? result.opts.map : {};
        const css = root.toResult(Object.assign(result.opts, {
            map: Object.assign({
                annotation: false,
                inline: false,
                sourcesContent: true,
            }, map),
        }));
        const options = Object.assign({
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
        const sassResult = sass.renderSync(options);
        const parsed = await postcss.parse(sassResult.css.toString(), {
            from: result.opts.from,
            map: sassResult.map && {
                prev: JSON.parse(sassResult.map.toString()),
            },
        });
        result.root = parsed;

        const dependencies = await Promise.all(
            sassResult.stats.includedFiles.map(async (fileName) => {
                if (existsSync(fileName)) {
                    return fileName;
                }
                return null;
            })
        );

        dependencies
            .filter((fileName) => !!fileName)
            .forEach((fileName) => {
                result.messages.push({
                    type: 'dependency',
                    plugin: 'postcss-dart-sass',
                    file: fileName,
                    parent: result.opts.from,
                });
            });
    }
);
