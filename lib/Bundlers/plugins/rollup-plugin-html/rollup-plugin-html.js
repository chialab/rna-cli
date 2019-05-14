const rollupPluginutils = require('rollup-pluginutils');

function normalizeText(text) {
    return text.replace(/\n/g, '\\n').replace(/'/g, '\\\'').replace(/import\.meta\.(ROLLUP_ASSET_URL_|ROLLUP_CHUNK_URL_)([\d\w]+)/g, '\' + import.meta.$1$2 + \'');
}

function fragmentToCode(fragment) {
    let code = '';
    [...fragment.childNodes].forEach((node) => {
        if (node.tagName) {
            code += `(function() {
    var element = document.createElement('${node.tagName}');
    ${[...node.attributes].map((attr) => `element.setAttribute('${attr.name}', '${normalizeText(attr.value)}');`).join('\n    ')}
    ${fragmentToCode(node)}.forEach(function(child) {
        element.appendChild(child);
    });
    return element;
}()),\n`;
        } else if (node.textContent) {
            code += `(function() {
    var element = document.createTextNode('${normalizeText(node.textContent)}');
    return element;
}()),\n`;
        }
    });

    return `[\n${code}]`;
}

module.exports = function(app, project, options) {
    return function(opts = {}) {
        const filter = rollupPluginutils.createFilter(opts.include || ['**/*.html', '**/*.htm'], opts.exclude);
        const scriptsModuleMap = new Map();

        return {
            name: 'html',

            async resolveId(id) {
                if (scriptsModuleMap.has(id)) {
                    return id;
                }
                return null;
            },

            async load(id) {
                if (scriptsModuleMap.has(id)) {
                    return scriptsModuleMap.get(id);
                }
                return null;
            },

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
                    handleScriptFile: async (input) => {
                        let chunkId = this.emitChunk(input.path);
                        return `import.meta.ROLLUP_CHUNK_URL_${chunkId}`;
                    },
                    handleScriptModules: async (code, root, elements, document) => {
                        let type = 'text/javascript';
                        if (options.format === 'esm') {
                            type = 'module';
                        }
                        let scriptId = `${input.ext('.m.js').path}`;
                        scriptsModuleMap.set(scriptId, code);
                        let chunkId = this.emitChunk(scriptId);
                        let node = document.createElement('script');
                        node.setAttribute('type', type);
                        let importerCode = `import('import.meta.ROLLUP_CHUNK_URL_${chunkId}');`;
                        if (options.format === 'system') {
                            importerCode = `System.import('import.meta.ROLLUP_CHUNK_URL_${chunkId}');`;
                        } else if (options.format === 'cjs') {
                            importerCode = `require('import.meta.ROLLUP_CHUNK_URL_${chunkId}');`;
                        }
                        node.textContent = importerCode;
                        return [node];
                    },
                });
                let { document } = await bundler.build();
                let htmlId = this.emitAsset(input.name, source);
                let code = `var childNodes = ${fragmentToCode(document)};
var fragment = document.createDocumentFragment();
while (childNodes.length) {
    fragment.appendChild(childNodes.shift());
}
export default fragment;
export const code = '${source.replace(/\n/g, '\\n').replace(/'/g, '\\\'')}';
export const url = import.meta.ROLLUP_ASSET_URL_${htmlId};`;
                return {
                    code,
                    map: { mappings: '' },
                };
            },
        };
    };
};
