const fs = require('fs');
const path = require('path');
const rollupPluginutils = require('@rollup/pluginutils');
const StyleBundler = require('../../StyleBundler');

function normalize(str = '') {
    return str.toString()
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'')
        .replace(/\n/g, '')
        .replace(/import\.meta\.ROLLUP_FILE_URL_([\d\w]+)/g, '\' + import.meta.ROLLUP_FILE_URL_$1 + \'');
}

module.exports = function(options) {
    const filter = rollupPluginutils.createFilter(options.include || ['**/*.scss', '**/*.sass', '**/*.css'], options.exclude);
    const output = options.output;
    const root = options.root;

    return {
        name: 'postcss',

        async load(id) {
            if (!filter(id)) {
                return null;
            }

            let contents = fs.readFileSync(id, 'utf8');
            return {
                code: `export default '${normalize(contents)}'`,
                map: { mappings: '' },
            };
        },

        async transform(code, id) {
            if (!filter(id)) {
                return null;
            }

            const bundle = new StyleBundler();
            await bundle.setup({
                input: id,
                output: output.file(path.basename(id)),
                root,
                map: false,
                lint: false,
                handleAssets: async (file) => {
                    if (!file || !fs.existsSync(file)) {
                        return;
                    }
                    let assetId = this.emitFile({
                        type: 'asset',
                        name: path.basename(file),
                        source: fs.readFileSync(file),
                    });
                    return `import.meta.ROLLUP_FILE_URL_${assetId}`;
                },
            });
            const result = await bundle.build();
            const css = normalize(result.css.toString());
            const cssId = this.emitFile({
                type: 'asset',
                name: `${path.basename(id, path.extname(id))}.css`,
                source: fs.readFileSync(id, 'utf8'),
            });

            return {
                code: `var css = '${css}';
var sheet;
try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
} catch(err) {
    sheet = err;
}

export default sheet;
export var code = css;
export var url = import.meta.ROLLUP_FILE_URL_${cssId};`,
                map: { mappings: '' },
            };
        },
    };
};
