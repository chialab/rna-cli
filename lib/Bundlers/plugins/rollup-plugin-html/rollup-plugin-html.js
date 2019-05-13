const rollupPluginutils = require('rollup-pluginutils');

module.exports = function(app, project, options) {
    return function(opts = {}) {
        const filter = rollupPluginutils.createFilter(opts.include || ['**/*.html', '**/*.htm'], opts.exclude);

        return {
            name: 'html',

            async transform(source, id) {
                if (!filter(id)) { return null; }

                const HTMLBundler = require('../../HTMLBundler.js');
                const StyleBundler = require('../../StyleBundler.js');

                let input = project.file(id);
                let bundler = new HTMLBundler(app, project);
                await bundler.setup({
                    input,
                    icon: false,
                    webmanifest: false,
                    progress: false,
                    handleStyleLink: async (input) => {
                        let styleBundler = new StyleBundler(app, project);
                        await styleBundler.setup({
                            input,
                            progress: false,
                            targets: options.targets,
                            production: options.production,
                            map: options.map,
                            lint: options.lint,
                        });
                        const { code } = await styleBundler.build();
                        let assetId = this.emitAsset(input.name, code);
                        return `import.meta.ROLLUP_ASSET_URL_${assetId}`;
                    },
                    handleScriptLink: async (input) => {
                        let chunkId = this.emitChunk(input.path);
                        return `import.meta.ROLLUP_CHUNK_URL_${chunkId}`;
                    },
                    handleAssetLink: async (input) => {
                        let assetId = this.emitAsset(input.name);
                        return `import.meta.ROLLUP_ASSET_URL_${assetId}`;
                    },
                });
                let { code: html } = await bundler.build();
                let htmlId = this.emitAsset(input.name, source);

                let code = `
var wrapper = document.createElement('div');
var childNodes = wrapper.childNodes;
wrapper.innerHTML = '${html.replace(/\n/g, '\\n').replace(/'/g, '\\\'').replace(/import\.meta\.(ROLLUP_ASSET_URL_|ROLLUP_CHUNK_URL_)([\d\w]+)/g, '\' + import.meta.$1$2 + \'')}';
console.log(wrapper.innerHTML)
var fragment = document.createDocumentFragment();
while (childNodes.length) {
    fragment.appendChild(childNodes[0]);
}
export default fragment;
export const code = '${source.replace(/\n/g, '\\n').replace(/'/g, '\\\'')}';
export const url = import.meta.ROLLUP_ASSET_URL_${htmlId};
`;
                return {
                    code,
                    map: { mappings: '' },
                };
            },
        };
    };
};
