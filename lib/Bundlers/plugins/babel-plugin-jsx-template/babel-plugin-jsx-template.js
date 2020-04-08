/**
 * Auto add export declaration for jsx files.
 */
function externalJSX({ types }) {
    return {
        name: 'transform-jsx-template',

        visitor: {
            Program(path) {
                const body = path.get('body');
                const filename = path.hub.file.opts.filename;
                if (!filename) {
                    return;
                }
                if (!filename.match(/\.jsx$/) && !filename.match(/\.tsx$/)) {
                    return;
                }

                const exportDecl = body.find((node) => node.isExportAllDeclaration() || node.isExportDefaultDeclaration() || node.isExportNamedDeclaration());
                if (exportDecl) {
                    // the program already has export declarations
                    return;
                }

                for (let i = body.length - 1; i >= 0; i--) {
                    let node = body[i];
                    if (types.isExpressionStatement(node)) {
                        // export the last expression statement in the file
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
            },
        },
    };
}

module.exports = externalJSX;
