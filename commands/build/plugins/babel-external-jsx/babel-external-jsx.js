/* eslint-env node */
const DEFAULT_HEADER = 'import React from \'react\';';

function externalJSX({ types, parse }) {
    return {
        visitor: {
            Program(path, state) {
                const opts = state.opts;
                const filename = path.hub.file.opts.filename;
                if (opts.include && !opts.include.test(filename)) {
                    return;
                }
                const body = path.get('body');
                const exportDecl = body.find((node) => node.isExportAllDeclaration() || node.isExportDefaultDeclaration() || node.isExportNamedDeclaration());
                if (exportDecl) {
                    return;
                }

                for (let i = body.length - 1; i >= 0; i--) {
                    let node = body[i];
                    if (types.isExpressionStatement(node)) {
                        const exp = node.get('expression').node;
                        node.replaceWith(
                            types.exportDefaultDeclaration(
                                types.functionDeclaration(
                                    null,
                                    [],
                                    types.blockStatement([
                                        types.returnStatement(exp),
                                    ])
                                )
                            )
                        );
                        break;
                    }
                }

                const header = opts.header || DEFAULT_HEADER;
                const importDecl = parse(header).program.body[0];
                path.unshiftContainer('body', importDecl);
            },
        },
    };
}

module.exports = externalJSX;
