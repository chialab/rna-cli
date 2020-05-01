const fs = require('fs');
const walk = require('acorn-walk');
const resolve = require('resolve');
const MagicString = require('magic-string');

function workerPlugin() {
    const map = new Map();

    return {
        name: 'worker',

        async transform(code, id) {
            if (!/new\s+(window\.|self\.)?Worker\s*\(/.test(code) && !/(self\.)?importScripts\s*\(/.test(code)) {
                return;
            }

            const ast = this.parse(code);
            const workerNodes = [];
            const importScriptsNodes = [];

            walk.simple(ast, {
                NewExpression(node) {
                    let callee = node.callee;
                    if (callee.type === 'MemberExpression') {
                        if (callee.object.name !== 'window' && callee.object.name !== 'self') {
                            return;
                        }
                        callee = callee.property;
                    }
                    if (callee.type !== 'Identifier' || callee.name !== 'Worker') {
                        return;
                    }
                    if (!node.arguments.length) {
                        return;
                    }
                    if (typeof node.arguments[0].value !== 'string') {
                        return;
                    }
                    workerNodes.push(node.arguments[0]);
                },
                CallExpression(node) {
                    let callee = node.callee;
                    if (callee.type === 'MemberExpression') {
                        if (callee.object.name !== 'self') {
                            return;
                        }
                        callee = callee.property;
                    }
                    if (callee.type !== 'Identifier' || callee.name !== 'importScripts') {
                        return;
                    }
                    if (!node.arguments.length) {
                        return;
                    }
                    if (typeof node.arguments[0].value !== 'string') {
                        return;
                    }

                    importScriptsNodes.push(node.arguments[0]);
                },
            });

            if (workerNodes.length === 0 &&
                importScriptsNodes.length === 0) {
                return;
            }

            const magicCode = new MagicString(code);

            (
                await Promise.all(
                    workerNodes.map(async (workerNode) => {
                        let workerMod = await this.resolve(workerNode.value, id);
                        return Object.assign({}, workerNode, {
                            value: workerMod.id,
                        });
                    })
                )
            ).forEach((workerNode) => {
                let workerId = this.emitFile({
                    type: 'chunk',
                    id: workerNode.value,
                });
                map.set(workerNode.value, workerId);
                magicCode.overwrite(workerNode.start, workerNode.end, `import.meta.ROLLUP_FILE_URL_${workerId}`);
            });

            (
                await Promise.all(
                    importScriptsNodes.map(async (workerNode) => {
                        let workerMod = await this.resolve(workerNode.value, id);
                        return Object.assign({}, workerNode, {
                            value: workerMod.id,
                        });
                    })
                )
            ).forEach((workerNode) => {
                let content = fs.readFileSync(workerNode.value).toString('base64');
                magicCode.overwrite(workerNode.start, workerNode.end, `'data:text/javascript;base64,${content}'`);
            });

            return {
                code: magicCode.toString(),
                map: magicCode.generateMap({ hires: true }),
            };
        },

        async renderChunk(code, chunk, options) {
            if (options.format !== 'system') {
                return;
            }
            if (!map.has(chunk.facadeModuleId)) {
                return;
            }
            const magicCode = new MagicString(code);
            const systemUrl = resolve.sync('systemjs/dist/s.min', {
                basedir: __dirname,
            });
            const systemCode = fs.readFileSync(systemUrl, 'utf8').replace(/\b(let|const)\b/g, 'var');
            magicCode.prepend(`${systemCode}\n`);
            magicCode.append('\nSystem.getRegister()[1]({}, System).execute();\n');
            return {
                code: magicCode.toString(),
                map: magicCode.generateMap({ hires: true }),
            };
        },
    };
}

module.exports = workerPlugin;
