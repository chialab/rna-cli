const rollupPluginutils = require('rollup-pluginutils');
const StyleBundler = require('../../StyleBundler');

function inline(str = '') {
    return str.toString()
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'')
        .replace(/\n/g, '');
}

const exported = [];

module.exports = function(app, project) {
    return function(options) {
        const filter = rollupPluginutils.createFilter(options.include || ['**/*.scss', '**/*.sass', '**/*.css'], options.exclude);
        const output = options.output;
        const root = options.root;

        let active = [];

        return {
            name: 'postcss',

            async transform(source, id) {
                if (!filter(id)) { return null; }

                let input = project.file(id);
                let bundle = new StyleBundler(app, project);
                await bundle.setup({
                    input,
                    output: output.file(input.basename),
                    root,
                    map: false,
                    progress: false,
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

                let css = await inline(result.css.toString());

                return {
                    code: `export default '${css}';`,
                    map: { mappings: '' },
                };
            },
        };
    };
};
