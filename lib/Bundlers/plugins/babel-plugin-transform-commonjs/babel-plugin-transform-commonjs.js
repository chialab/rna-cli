const GLOBAL_CACHE = new Map();

/**
 * Transform commonjs `require` and `exports` statements.
 */
function transformCommon({ types }) {
    /**
     * Rename require references.
     *
     * @param {NodePath} path The function declaration path.
     * @return {void}
     */
    function renameRequire(path) {
        let params = path.node.params || [];
        if (params.some((param) => param.name === 'require')) {
            path.scope.rename('require');
        }
    }

    function isGlobal(program, object, scope) {
        scope = scope || object.scope;
        if (scope === program.scope) {
            return true;
        }
        if (object.node.name in scope.bindings) {
            return false;
        }
        return isGlobal(program, object, scope.parent);
    }

    return {
        visitor: {
            Program(program, state) {
                let { cache } = state.opts;
                if (!cache) {
                    cache = GLOBAL_CACHE;
                }

                const body = program.get('body');
                const filename = program.hub.file.opts.filename;
                const globals = program.scope.globals;

                if (
                    body.find((entry) => entry.isExportDeclaration() || entry.isImportDeclaration()) ||
                    ('import' in globals)
                ) {
                    return;
                }

                // check if the program uses module.exports
                const HAS_EXPORTS = ('module' in globals) || ('exports' in globals);
                const HAS_REQUIRE = 'require' in globals;
                const IS_UMD = ('define' in globals && 'window' in globals);

                if (!HAS_EXPORTS && !HAS_REQUIRE) {
                    return;
                }

                if (!IS_UMD) {
                    program.traverse({
                        FunctionExpression: renameRequire,
                        FunctionDeclaration: renameRequire,
                    });
                }

                ['window', 'global', 'self'].forEach((globalName) => {
                    if (globalName in program.scope.bindings) {
                        program.scope.rename(globalName);
                    }
                });

                if (!cache.has(filename)) {
                    cache.set(filename, `${cache.size}`);
                }

                const moduleId = cache.get(filename);
                // global commonjs modules scope.
                const globalObject = program.scope.generateUidIdentifier('global');
                const localRegistry = program.scope.generateUidIdentifier('registry');
                const localExports = types.memberExpression(localRegistry, types.stringLiteral(moduleId), true);
                const globalRegistryDecl = types.variableDeclaration(
                    'var',
                    [
                        types.variableDeclarator(
                            globalObject,
                            types.conditionalExpression(
                                types.binaryExpression(
                                    '!==',
                                    types.unaryExpression(
                                        'typeof',
                                        types.identifier('window'),
                                    ),
                                    types.stringLiteral('undefined'),
                                ),
                                types.identifier('window'),
                                types.conditionalExpression(
                                    types.binaryExpression(
                                        '!==',
                                        types.unaryExpression(
                                            'typeof',
                                            types.identifier('global'),
                                        ),
                                        types.stringLiteral('undefined'),
                                    ),
                                    types.identifier('global'),
                                    types.identifier('self')
                                )
                            ),
                        ),
                        types.variableDeclarator(
                            localRegistry,
                            types.assignmentExpression(
                                '=',
                                types.memberExpression(globalObject, types.stringLiteral('__commonjs__registry__'), true),
                                types.logicalExpression(
                                    '||',
                                    types.memberExpression(globalObject, types.stringLiteral('__commonjs__registry__'), true),
                                    types.objectExpression([]),
                                )
                            )
                        ),
                    ],
                );
                const globalAssignment = types.expressionStatement(
                    types.assignmentExpression(
                        '=',
                        localExports,
                        types.logicalExpression(
                            '||',
                            localExports,
                            types.objectExpression([]),
                        )
                    )
                );
                const assignments = [globalRegistryDecl, globalAssignment];
                const imports = [];

                // collect all `require` statements and create import declarations.
                if (!IS_UMD) {
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
                            const moduleName = requiredArg.node.value;

                            if (path.parentPath.isExpressionStatement()) {
                                imports.push(
                                    types.importDeclaration([], types.stringLiteral(moduleName))
                                );
                                // remove the require calls.
                                path.remove();

                                return;
                            }

                            // assign to global scope
                            const id = program.scope.generateUidIdentifier(moduleName);
                            const local = program.scope.generateUidIdentifier(moduleName);

                            imports.push(
                                types.importDeclaration(
                                    [
                                        types.importNamespaceSpecifier(id),
                                    ],
                                    types.stringLiteral(moduleName)
                                )
                            );

                            assignments.push(
                                types.variableDeclaration(
                                    'var',
                                    [
                                        types.variableDeclarator(
                                            local,
                                            types.conditionalExpression(
                                                types.binaryExpression(
                                                    'in',
                                                    types.stringLiteral('default'),
                                                    id
                                                ),
                                                types.memberExpression(id, types.identifier('default')),
                                                id
                                            )
                                        ),
                                    ]
                                )
                            );

                            // replace the require call with the imported value.
                            path.replaceWith(local);
                        },
                    });
                }

                if (HAS_EXPORTS) {
                    // setup the scope of the module.
                    const moduleIdentifier = program.scope.generateUidIdentifier('module');
                    const named = {};

                    program.traverse({
                        // intercept assignment expressions.
                        AssignmentExpression(path) {
                            let left = path.get('left');
                            if (!left.isIdentifier() && !left.isMemberExpression()) {
                                // not export statement.
                                return;
                            }
                            let object = left.get('object');
                            if (!object.isMemberExpression() && !object.isIdentifier()) {
                                // not export assignment.
                                return;
                            }
                            // check for module.exports.prop = yyy;
                            if (object.isMemberExpression() && (object.get('object').node.name !== 'module' || object.get('property').node.name !== 'exports')) {
                                // not export assignment.
                                return;
                                // check for exports.prop = yyy;
                            } else if (object.isIdentifier() && object.node.name !== 'exports') {
                                // not export assignment.
                                return;
                            }
                            if (!isGlobal(program, object)) {
                                return;
                            }
                            let node = left.get('property').node;
                            if (node.name) {
                                named[node.name] = node;
                            }
                        },
                    });

                    // initialize the scope variable.
                    const assignment = types.variableDeclaration(
                        'var',
                        [
                            types.variableDeclarator(
                                moduleIdentifier,
                                types.objectExpression([
                                    types.objectMethod('get', types.identifier('exports'), [], types.blockStatement([
                                        types.returnStatement(localExports),
                                    ])),
                                    types.objectMethod('set', types.identifier('exports'), [types.identifier('_')], types.blockStatement([
                                        types.expressionStatement(
                                            types.assignmentExpression(
                                                '=',
                                                localExports,
                                                types.identifier('_')
                                            )
                                        ),
                                    ])),
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
                                types.blockStatement(body.map((child) => {
                                    if (child.isImportDeclaration()) {
                                        return;
                                    }
                                    let node = child.node;
                                    child.remove();
                                    return node;
                                }).filter(Boolean))
                            ),
                            [moduleIdentifier, types.memberExpression(moduleIdentifier, types.identifier('exports'))]
                        )
                    );

                    program.unshiftContainer('body', assignment);
                    program.pushContainer('body', wrap);

                    let exportDefault = true;

                    const globalVars = Object.keys(globals).filter((name) => name in named);

                    // rename other `require` function references.
                    program.traverse({
                        Identifier(path) {
                            if (globalVars.indexOf(path.node.name) === -1) {
                                return;
                            }

                            if (path.parentPath.isFunctionExpression() ||
                                path.parentPath.isFunctionDeclaration() ||
                                path.parentPath.isClassMethod() ||
                                path.parentPath.isClassProperty() ||
                                path.parentPath.isClassPrivateProperty()) {
                                return;
                            }

                            if (path.parentPath.isMemberExpression()) {
                                if (path.parentPath.get('property') === path) {
                                    return;
                                }
                            }

                            if (path.parentPath.isVariableDeclarator()) {
                                if (path.parentPath.get('id') === path) {
                                    return;
                                }
                            }

                            path.replaceWith(
                                types.memberExpression(globalObject, path.node)
                            );
                        },
                    });

                    for (let specName in named) {
                        let propName = named[specName];
                        if (specName === 'default') {
                            exportDefault = false;
                            program.pushContainer('body', types.exportDefaultDeclaration(
                                types.memberExpression(
                                    types.memberExpression(
                                        moduleIdentifier,
                                        types.identifier('exports')
                                    ),
                                    propName,
                                    !types.isIdentifier(propName)
                                )
                            ));
                        } else {
                            if (!types.isValidIdentifier(specName)) {
                                continue;
                            }
                            program.pushContainer('body', types.exportNamedDeclaration(
                                types.variableDeclaration(
                                    'var',
                                    [
                                        types.variableDeclarator(
                                            types.identifier(specName),
                                            types.memberExpression(
                                                types.memberExpression(
                                                    moduleIdentifier,
                                                    types.identifier('exports')
                                                ),
                                                propName,
                                                !types.isIdentifier(propName)
                                            )
                                        ),
                                    ]
                                ),
                                []
                            ));
                        }
                    }

                    if (exportDefault) {
                        // create the export declaration.
                        program.pushContainer('body', types.exportDefaultDeclaration(
                            types.memberExpression(
                                moduleIdentifier,
                                types.identifier('exports')
                            )
                        ));
                    }
                }

                // move all imports to the top of the body.
                if (imports.length || HAS_EXPORTS) {
                    assignments.reverse().forEach((declaration) => {
                        program.unshiftContainer('body', declaration);
                    });

                    imports.reverse().forEach((declaration) => {
                        program.unshiftContainer('body', declaration);
                    });
                }
            },
        },
    };
}

module.exports = transformCommon;
