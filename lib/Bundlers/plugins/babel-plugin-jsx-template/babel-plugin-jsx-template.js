/**
 * Auto add export declaration for jsx files.
 */
function externalJSX({ types }) {
    return {
        name: 'transform-jsx-template',

        visitor: {
            Program(path) {
                let body = path.get('body');
                let filename = path.hub.file.opts.filename;
                if (!filename) {
                    return;
                }
                if (!filename.match(/\.jsx$/) && !filename.match(/\.tsx$/)) {
                    return;
                }

                let exportDecl = body.find((node) => node.isExportAllDeclaration() || node.isExportDefaultDeclaration() || node.isExportNamedDeclaration());
                if (exportDecl) {
                    // the program already has export declarations
                    return;
                }

                for (let i = body.length - 1; i >= 0; i--) {
                    let node = body[i];
                    if (types.isExpressionStatement(node)) {
                        // eslint-disable-next-line
                        console.warn(`${filename} does not export JSX expressions.\nAuto detect export from JSX files has been deprecated.`);

                        // export the last expression statement in the file
                        let exp = node.get('expression').node;
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
