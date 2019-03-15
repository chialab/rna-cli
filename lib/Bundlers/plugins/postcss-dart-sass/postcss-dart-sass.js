const path = require('path');
const postcss = require('postcss');
const sass = require('sass');

module.exports = postcss.plugin('postcss-dart-sass-plugin', (opts) => {
    opts = opts || {};

    return async (root, result) => {
        let extname = result.opts.from ? path.extname(result.opts.from) : null;
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
        let parsed = await postcss.parse(sassResult.css.toString(), {
            from: result.opts.from,
            map: sassResult.map && {
                prev: JSON.parse(sassResult.map.toString()),
            },
        });
        result.root = parsed;
        result.dependencies = sassResult.stats.includedFiles;
    };
});
