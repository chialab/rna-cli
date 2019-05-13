const walk = require('acorn-walk');
const MagicString = require('magic-string');

function workerPlugin() {
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

            workerNodes.forEach((workerNode) => {
                let workerId = this.emitChunk(workerNode.value);
                magicCode.overwrite(workerNode.start, workerNode.end, `import.meta.ROLLUP_CHUNK_URL_${workerId}`);
            });

            return {
                code: magicCode.toString(),
                map: magicCode.generateMap({ hires: true }),
            };
        },
    };
}

module.exports = workerPlugin;
