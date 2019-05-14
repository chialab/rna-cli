const walk = require('acorn-walk');
const MagicString = require('magic-string');

function workerPlugin() {
    const map = new Map();

    return {
        name: 'worker',

        async transform(code, id) {
            if (!/new\s+Worker/.test(code)) {
                return;
            }

            const ast = this.parse(code);
            let workerNodes = [];

            walk.simple(ast, {
                NewExpression(node) {
                    if (node.callee.name !== 'Worker') {
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
            });

            if (workerNodes.length === 0) {
                return;
            }

            const magicCode = new MagicString(code);

            workerNodes = await Promise.all(
                workerNodes.map(async (workerNode) =>
                    Object.assign({}, workerNode, {
                        value: await this.resolveId(workerNode.value, id),
                    })
                )
            );

            await Promise.all(
                workerNodes.map(async (workerNode) => {
                    let workerId = this.emitChunk(workerNode.value);
                    map.set(workerNode.value, workerId);
                    magicCode.overwrite(workerNode.start, workerNode.end, `import.meta.ROLLUP_CHUNK_URL_${workerId}`);
                })
            );

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
            magicCode.prepend('importScripts(\'./s.min.js\');\n');
            magicCode.append('\nSystem.getRegister()[1]({}, System).execute();\n');
            return {
                code: magicCode.toString(),
                map: magicCode.generateMap({ hires: true }),
            };
        },
    };
}

module.exports = workerPlugin;
