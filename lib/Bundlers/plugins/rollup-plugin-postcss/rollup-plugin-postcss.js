const fs = require('fs');
const path = require('path');
const rollupPluginutils = require('rollup-pluginutils');
const StyleBundler = require('../../StyleBundler');

function normalize(str = '') {
    return str.toString()
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'')
        .replace(/\n/g, '')
        .replace(/import\.meta\.ROLLUP_ASSET_URL_([\d\w]+)/g, '\' + import.meta.ROLLUP_ASSET_URL_$1 + \'');
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

            let bundle = new StyleBundler();
            await bundle.setup({
                input: id,
                output: output.file(path.basename(id)),
                root,
                map: false,
                handleCSSAsset: async (file) => {
                    if (!fs.existsSync(file)) {
                        return;
                    }
                    let assetContents = fs.readFileSync(file);
                    let assetFileId = path.basename(file);
                    let assetId = this.emitAsset(assetFileId, assetContents);
                    return `import.meta.ROLLUP_ASSET_URL_${assetId}`;
                },
            });
            let result = await bundle.build();
            let css = normalize(result.css.toString());
            let cssId = this.emitAsset(`${path.basename(id, path.extname(id))}.css`, fs.readFileSync(id, 'utf8'));

            return {
                code: `var sheet;
var css = '${css}';
if (CSSStyleSheet.prototype.replaceSync) {
sheet = new CSSStyleSheet();
sheet.replaceSync(css);
} else {
var style = document.createElement('style');
style.innerText = css;
document.head.appendChild(style);
sheet = style.sheet;
document.head.removeChild(style);
}
export default sheet;
export var code = css;
export var url = import.meta.ROLLUP_ASSET_URL_${cssId};`,
                map: { mappings: '' },
            };
        },
    };
};
