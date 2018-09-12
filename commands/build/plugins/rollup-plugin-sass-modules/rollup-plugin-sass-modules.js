const fs = require('fs');
const rollupPluginutils = require('rollup-pluginutils');
const sass = require('sass');
const importRegex = /@import[\s'"]*([^;'"]*)[;'"]/g;
const includePaths = ['node_modules'];
const resolver = require('../sass-resolver/sass-resolver');

function stylize(css) {
    return `

(function(){
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.textContent = '${css}';
    head.appendChild(style);
})();
`;
}

function inline(str = '') {
    return str.toString()
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'')
        .replace(/\n/g, '');
}

const exported = [];

module.exports = async function(options) {
    const filter = rollupPluginutils.createFilter(options.include || ['**/*.scss', '**/*.sass'], options.exclude);
    const importer = options.importer || resolver();
    const processor = options.processor || (async(code) => code);
    const defaults = options.options || {};
    let file;
    let active = [];
    return {
        name: 'sass-modules',

        async transform(code, id) {
            if (!filter(id)) { return null; }
            let match = importRegex.exec(code);
            let matches = [];
            while (match) {
                matches.push(match[1]);
                match = importRegex.exec(code);
            }
            matches = matches.map((url) => importer(url, id).file);
            active.push(...matches);
            let jsCode = matches.map((url, index) => `import STYLE_${index} from '${url}';`).join('\n');
            if (active.indexOf(id) !== -1) {
                active.splice(active.indexOf(id), 1);
                jsCode += '\nexport default \'\';';
                return {
                    code: jsCode,
                    map: { mappings: '' },
                };
            }
            exported.push(id);
            let sassOptions = Object.assign({
                file: id,
                includePaths,
                importer: (url, prev) => importer(url, prev, options),
            }, defaults);
            sassOptions.omitSourceMapUrl = true;
            sassOptions.sourceMapEmbed = false;
            let result = await new global.Promise((resolve, reject) => {
                sass.render(sassOptions, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
            let css = await processor(inline(result.css));
            if (options.insert) {
                jsCode += stylize(css);
            } else {
                jsCode += `export default '${css}';`;
            }
            return {
                code: jsCode,
                map: { mappings: '' },
            };
        },

        async ongenerate(options) {
            if (!defaults.outFile) {
                return;
            }
            file = '';
            for (let i = 0; i < exported.length; i++) {
                let id = exported[id];
                let sassOptions = Object.assign({
                    file: id,
                    includePaths,
                    importer: (url, prev) => importer(url, prev, options),
                }, defaults);
                let result = sass.renderSync(sassOptions).css.toString();
                let css = await processor(result);
                file += css;
            }
        },

        async onwrite() {
            if (defaults.outFile && file) {
                fs.writeFileSync(defaults.outFile, file);
                file = null;
            }
        },
    };
};
