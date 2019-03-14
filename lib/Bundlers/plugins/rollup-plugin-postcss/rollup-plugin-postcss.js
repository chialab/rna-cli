const fs = require('fs');
const rollupPluginutils = require('rollup-pluginutils');
const StyleBundler = require('../../StyleBundler');

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

module.exports = function(app, project) {
    return function(options) {
        const filter = rollupPluginutils.createFilter(options.include || ['**/*.scss', '**/*.sass'], options.exclude);
        const defaults = options.options || {};

        let file;
        let active = [];

        return {
            name: 'postcss',

            async transform(source, id) {
                if (!filter(id)) { return null; }

                let options = Object.assign({}, defaults, {
                    input: id,
                });

                let bundle = new StyleBundler(app, project);
                await bundle.setup(options);
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

                let css = await inline(result.css.toString());
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

            async generateBundle(options, bundle, isWrite) {
                if (!defaults.outFile) {
                    return;
                }
                if (isWrite) {
                    if (defaults.outFile && file) {
                        fs.writeFileSync(defaults.outFile, file);
                        file = null;
                    }
                } else {
                    file = '';
                    for (let i = 0; i < exported.length; i++) {
                        let id = exported[id];
                        let options = Object.assign({
                            file: id,
                        }, defaults);
                        let bundle = new StyleBundler(app, project);
                        await bundle.setup(options);
                        let manifest = await bundle.build();
                        file += manifest.css;
                    }
                }
            },
        };
    };
};
