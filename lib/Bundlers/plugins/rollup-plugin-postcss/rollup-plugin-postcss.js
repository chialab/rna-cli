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

const exported = [];

module.exports = function(options) {
    const filter = rollupPluginutils.createFilter(options.include || ['**/*.scss', '**/*.sass', '**/*.css'], options.exclude);
    const output = options.output;
    const root = options.root;

    let active = [];

    return {
        name: 'postcss',

        async load(id) {
            if (!filter(id)) { return null; }

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
                    let assetId = this.emitAsset(path.basename(file), fs.readFileSync(file));
                    return `import.meta.ROLLUP_ASSET_URL_${assetId}`;
                },
            });
            let result = await bundle.build();

            let dependencies = bundle.files.filter((file) => (file !== id));
            let jsCode = dependencies
                .map((url, index) => `import STYLE_${index} from '${url}';`)
                .join('\n');

            active.push(...dependencies);
            if (active.includes(id)) {
                active.splice(active.indexOf(id), 1);
                jsCode += '\nexport default \'\';';
                return {
                    code: jsCode,
                    map: { mappings: '' },
                };
            }
            exported.push(id);

            let css = normalize(result.css.toString());
            let cssId = this.emitAsset(`${path.basename(id, path.extname(id))}.css`, result.css.toString());

            return {
                code: `
var sheet;
if (CSSStyleSheet.prototype.replaceSync) {
sheet = new CSSStyleSheet();
sheet.replaceSync('${css}');
} else {
var style = document.createElement('style');
style.innerText = '${css}';
document.head.appendChild(style);
sheet = style.sheet;
document.head.removeChild(style);
}
export default sheet;
export const code = '${css}';
export const url = import.meta.ROLLUP_ASSET_URL_${cssId};
`,
                map: { mappings: '' },
            };
        },
    };
};
