const { promises: { readFile } } = require('fs');
const { createFilter } = require('@rollup/pluginutils');
const path = require('path');
const walk = require('acorn-walk');
const MagicString = require('magic-string');

const defaultInclude = [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.gif',
];

function getResolveUrl(path) {
    return `new (require('url').URL)('file:' + __dirname + '/${path}').href`;
}

function getRelativeUrlFromDocument(relativePath) {
    return `(function() {
    if (document.currentScript) {
        return new URL('../${relativePath}', document.currentScript.src.split('?')[0]).href;
    } else if (document.baseURI) {
        return new URL('../${relativePath}', document.baseURI.split('?')[0]).href;
    }
    return new URL('../${relativePath}');
})()`;
}

function url(options = {}) {
    const filter = createFilter(options.include || defaultInclude, options.exclude);

    return {
        name: 'url',

        async load(id) {
            if (!filter(id)) {
                return null;
            }
            let buffer = await readFile(id);
            let asset = this.emitFile({
                type: 'asset',
                name: path.basename(id),
                source: buffer,
            });
            return `export default import.meta.ROLLUP_FILE_URL_${asset};`;
        },

        async transform(code, id) {
            if (!/new\s+(window\.|self\.|globalThis\.)?URL\s*\(/.test(code)) {
                return;
            }

            const ast = this.parse(code);
            const urlNodes = [];

            walk.simple(ast, {
                MemberExpression(node) {
                    if (node.property.name !== 'href') {
                        return;
                    }
                    if (node.object.type !== 'NewExpression') {
                        return;
                    }
                    let expression = node.object;
                    let callee = expression.callee;
                    if (callee.type === 'MemberExpression') {
                        if (callee.object.name !== 'window' &&
                            callee.object.name !== 'self' &&
                            callee.object.name !== 'globalThis') {
                            return;
                        }
                        callee = callee.property;
                    }
                    if (callee.type !== 'Identifier' || callee.name !== 'URL') {
                        return;
                    }
                    if (expression.arguments.length != 2) {
                        return;
                    }
                    if (typeof expression.arguments[0].value !== 'string') {
                        return;
                    }
                    if (expression.arguments[1].type !== 'MemberExpression') {
                        return;
                    }
                    if (expression.arguments[1].object.type !== 'MetaProperty') {
                        return;
                    }
                    if (expression.arguments[1].object.property.name !== 'meta') {
                        return;
                    }
                    if (expression.arguments[1].property.name !== 'url') {
                        return;
                    }
                    urlNodes.push(node);
                },
            });

            if (urlNodes.length === 0) {
                return;
            }

            const magicCode = new MagicString(code);

            await Promise.all(
                urlNodes.map(async (node) => {
                    let { id: fileId } = await this.resolve(node.object.arguments[0].value, id);
                    let buffer = await readFile(fileId);
                    let assetId = this.emitFile({
                        type: 'asset',
                        name: path.basename(fileId),
                        source: buffer,
                    });
                    magicCode.overwrite(node.start, node.end, `import.meta.ROLLUP_FILE_URL_${assetId}`);
                })
            );

            return {
                code: magicCode.toString(),
                map: magicCode.generateMap({ hires: true }),
            };
        },

        resolveFileUrl(file) {
            const { fileName, relativePath, format } = file;
            if (format !== 'cjs' && format !== 'umd') {
                // default loader
                return;
            }
            return `(typeof URL === 'undefined' ? ${getResolveUrl(fileName)} : ${getRelativeUrlFromDocument(relativePath)})`;
        },
    };
}

module.exports = url;
