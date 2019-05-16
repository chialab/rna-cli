const fs = require('fs');
const path = require('path');
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

module.exports = function(options = {}) {
    const filter = rollupPluginutils.createFilter(options.include || ['**/*.html', '**/*.htm'], options.exclude);
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

            let bundler = new HTMLBundler();
            await bundler.setup({
                input: id,
                fragment: true,
                handleStyleLink: async (input) => {
                    let styleBundler = new StyleBundler();
                    await styleBundler.setup({
                        input,
                        targets: options.targets,
                        production: options.production,
                        map: options.map,
                        lint: options.lint,
                        handleCSSAsset: this.handleCSSAsset,
                    });
                    const { code } = await styleBundler.build();
                    let assetId = this.emitAsset(input.name, code);
                    return `import.meta.ROLLUP_ASSET_URL_${assetId}`;
                },
                handleCSSAsset: async (file) => {
                    let assetId = this.emitAsset(path.basename(file), fs.readFileSync(file));
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
                    let scriptId = path.join(path.dirname(id), `${path.basename(id, path.extname(id))}.m.js`);
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
            let htmlId = this.emitAsset(path.basename(id), source);
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
