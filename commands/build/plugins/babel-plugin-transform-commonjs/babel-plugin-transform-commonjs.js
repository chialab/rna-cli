function renameRequire(path) {
    if ((path.node.params || []).find((param) => param.name === 'require')) {
        path.scope.rename('require');
    }
}

/**
 * Transform commonjs `require` and `exports` statements.
 */
function transformCommon({ types }) {
    return {
        visitor: {
            Program(program) {
                const body = program.get('body');
                // check if the file has not ES6 imports/exports. Do not handle mixed mode.
                for (const child of body) {
                    if (types.isImportDeclaration(child) || types.isExportDeclaration(child)) {
                        // ES6 import/export found, exit.
                        return;
                    }
                }

                // setup the scope of the module.
                const scope = program.scope.generateUidIdentifier('scope');

                program.traverse({
                    FunctionExpression: renameRequire,
                    FunctionDeclaration: renameRequire,
                });

                // collect all `require` statements and create import declarations.
                const imports = [];
                program.traverse({
                    // intercept call expressions.
                    CallExpression(path) {
                        if (path.get('callee.name').node !== 'require') {
                            // the called function is not `require`, ignore it.
                            return;
                        }
                        const args = path.get('arguments');
                        if (args.length !== 1) {
                            return;
                        }
                        const requiredArg = path.get('arguments.0');
                        if (!types.isStringLiteral(requiredArg.node)) {
                            // the required argument is not a string, so we can not handle it during the transpiling.
                            return;
                        }

                        // add to the list.
                        const modName = requiredArg.node.value;
                        // assign to global scope
                        const id = program.scope.generateUidIdentifier(modName);
                        // replace the require call with the imported value.
                        path.replaceWith(id);
                        // create an ES6 import declaration.
                        imports.push(
                            types.importDeclaration(
                                [types.importDefaultSpecifier(id)],
                                types.stringLiteral(modName)
                            )
                        );
                    },
                });

                // setup the module scope variable as `{ exports: {} }`.
                const assignment = types.variableDeclaration(
                    'const',
                    [
                        types.variableDeclarator(
                            scope,
                            types.objectExpression([
                                types.objectProperty(types.identifier('exports'), types.objectExpression([])),
                            ])
                        ),
                    ]
                );

                // wrap the body of the module in order to usce the scope variable.
                // `(function(module, exports) { <body> }(scope, scope.exports))`
                const wrap = types.expressionStatement(
                    types.callExpression(
                        types.functionExpression(
                            null,
                            [types.identifier('module'), types.identifier('exports')],
                            types.blockStatement(program.node.body.slice(0))
                        ),
                        [scope, types.memberExpression(scope, types.identifier('exports'))]
                    )
                );

                // create the export declaration.
                const exportDecl = types.exportDefaultDeclaration(
                    types.memberExpression(
                        scope,
                        types.identifier('exports')
                    )
                );

                // remove old body.
                body.forEach((path) => path.remove());
                // add new body declarations.
                imports.forEach((declaration) => program.pushContainer('body', declaration));
                program.pushContainer('body', assignment);
                program.pushContainer('body', wrap);
                program.pushContainer('body', exportDecl);
            },
        },
    };
}

module.exports = transformCommon;
