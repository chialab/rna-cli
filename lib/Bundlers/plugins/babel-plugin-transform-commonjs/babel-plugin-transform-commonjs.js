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

                for (let i = 0, len = body.length; i < len; i++) {
                    const item = body[i];
                    if (item.isImportDeclaration() || item.isExportDeclaration()) {
                        return;
                    }
                }

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
                        const decl = types.importDeclaration(
                            [types.importDefaultSpecifier(id)],
                            types.stringLiteral(modName)
                        );
                        imports.push(decl);
                    },
                });

                if (imports.length === 0 && !('module' in program.scope.globals) && !('exports' in program.scope.globals)) {
                    // not commonjs module
                    return;
                }

                // setup the scope of the module.
                const scope = types.identifier('module');

                // wrap the body of the module in order to usce the scope variable.
                // `(function(module, exports) { <body> }(scope, scope.exports))`
                let assignment = types.variableDeclaration(
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

                assignment.__scope = true;

                const wrap = types.expressionStatement(
                    types.callExpression(
                        types.functionExpression(
                            null,
                            [types.identifier('module'), types.identifier('exports')],
                            types.blockStatement(body.map((child) => {
                                if (child.isImportDeclaration()) {
                                    return;
                                }
                                let node = child.node;
                                child.remove();
                                return node;
                            }).filter(Boolean))
                        ),
                        [scope, types.memberExpression(scope, types.identifier('exports'))]
                    )
                );

                program.unshiftContainer('body', assignment);
                program.pushContainer('body', wrap);

                // create the export declaration.
                program.pushContainer('body', types.exportDefaultDeclaration(
                    types.memberExpression(
                        scope,
                        types.identifier('exports')
                    )
                ));

                imports.reverse().forEach((declaration) => program.unshiftContainer('body', declaration));
            },
        },
    };
}

module.exports = transformCommon;
