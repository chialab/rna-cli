const fs = require('fs');
const path = require('path');
const rollupPluginutils = require('@rollup/pluginutils');

function normalizeText(text) {
    return text.replace(/\n/g, '\\n').replace(/'/g, '\\\'').replace(/import\.meta\.ROLLUP_FILE_URL_([\d\w]+)/g, '\' + import.meta.$1$2 + \'');
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
            if (!filter(id)) {
                return null;
            }

            const HTMLBundler = require('../../HTMLBundler');
            const StyleBundler = require('../../StyleBundler');

            let source = fs.readFileSync(id, 'utf8');
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
                        handleAssets: this.handleCSSAssets,
                    });
                    let { code } = await styleBundler.build();
                    let assetId = this.emitFile({
                        type: 'asset',
                        name: input.name,
                        source: code,
                    });

                    return `import.meta.ROLLUP_FILE_URL_${assetId}`;
                },
                handleCSSAssets: async (input) => {
                    const assetId = this.emitFile({
                        type: 'asset',
                        name: input.name,
                        source: await input.read(),
                    });

                    return `import.meta.ROLLUP_FILE_URL_${assetId}`;
                },
                handleScriptLink: async (input) => {
                    let chunkId = this.emitFile({
                        type: 'chunk',
                        name: input.name,
                        id: input.path,
                    });

                    return `import.meta.ROLLUP_FILE_URL_${chunkId}`;
                },
                handleAssetLink: async (input) => {
                    let assetId = this.emitFile({
                        type: 'asset',
                        name: input.name,
                        source: await input.read(),
                    });

                    return `import.meta.ROLLUP_FILE_URL_${assetId}`;
                },
                handleScriptFile: async (input) => {
                    let chunkId = this.emitFile({
                        type: 'chunk',
                        name: input.name,
                        id: input.path,
                    });

                    return `import.meta.ROLLUP_FILE_URL_${chunkId}`;
                },
                handleScriptModules: async (code, root, elements, document) => {
                    let type = 'text/javascript';
                    if (options.format === 'esm') {
                        type = 'module';
                    }
                    let scriptId = path.join(path.dirname(id), `${path.basename(id, path.extname(id))}.m.js`);
                    scriptsModuleMap.set(scriptId, code);
                    let chunkId = this.emitFile({
                        type: 'chunk',
                        name: path.basename(id),
                        id: scriptId,
                    });
                    let node = document.createElement('script');
                    node.setAttribute('type', type);
                    let importerCode = `import('import.meta.ROLLUP_FILE_URL_${chunkId}');`;
                    if (options.format === 'system') {
                        importerCode = `System.import('import.meta.ROLLUP_FILE_URL_${chunkId}');`;
                    } else if (options.format === 'cjs') {
                        importerCode = `require('import.meta.ROLLUP_FILE_URL_${chunkId}');`;
                    }
                    node.textContent = importerCode;

                    return [node];
                },
            });
            let { fragment } = await bundler.build();
            let htmlId = this.emitFile({
                type: 'asset',
                name: path.basename(id),
                source,
            });
            let code = `var childNodes = ${fragmentToCode(fragment)};
var fragment = document.createDocumentFragment();
while (childNodes.length) {
fragment.appendChild(childNodes.shift());
}
export default fragment;
export const code = '${source.replace(/\n/g, '\\n').replace(/'/g, '\\\'')}';
export const url = import.meta.ROLLUP_FILE_URL_${htmlId};`;
            return {
                code,
                map: { mappings: '' },
            };
        },
    };
};
