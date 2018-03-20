const nodePath = require('path');
const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');
const resolve = require('resolve');

const BABEL_HELPERS = 'rollupPluginBabelHelpers';
const CJS_HELPERS = 'rollupCommonGlobal';
const CJS_REQUIRED = {};
let CJS_COUNTER = 0;

function helperPlugin() {
    return {
        pre(file) {
            const cachedHelpers = {};
            file.set('helperGenerator', name => {
                if (cachedHelpers[name]) {
                    return cachedHelpers[name];
                }
                return (cachedHelpers[name] = babelModuleImports.addNamed(file.path, name, BABEL_HELPERS));
            });
        },
    };
}

function commonRequire({ types }) {
    const statements = [];
    return {
        visitor: {
            FunctionExpression(path) {
                if ((path.node.params || []).find((param) => param.name === 'require')) {
                    path.scope.rename('require');
                }
            },
            FunctionDeclaration(path) {
                if ((path.node.params || []).find((param) => param.name === 'require')) {
                    path.scope.rename('require');
                }
            },
            // intercept call expressions.
            CallExpression(path) {
                const node = path.node;
                if (node.callee.name !== 'require') {
                    // the called function is not `require`, ignore it.
                    return;
                }
                if (node.arguments.length !== 1 || node.arguments[0].type !== 'StringLiteral') {
                    // the required argument is not a string, so we can not handle it during the transpiling.
                    return;
                }

                if (resolve.isCore(node.arguments[0].value)) {
                    return;
                }
                statements.push(path);
            },
        },
        post() {
            let globalScope = false;
            let body;
            if (statements.length) {
                statements.reverse().forEach((path) => {
                    const node = path.node;
                    const filename = path.hub.file.opts.filename;
                    // create an ES6 import declaration.
                    let modName = node.arguments[0].value;
                    let fullName = resolve.sync(modName, { basedir: nodePath.dirname(filename) });
                    let id;
                    body = body || path.hub.file.path.node.body;
                    if (CJS_REQUIRED[fullName]) {
                        globalScope = globalScope || path.scope.generateUidIdentifierBasedOnNode('scope');
                        id = types.memberExpression(globalScope, CJS_REQUIRED[fullName]);
                        // assign to global scope
                        let scopeAssign = types.expressionStatement(
                            types.assignmentExpression(
                                '=',
                                id,
                                types.logicalExpression(
                                    '||',
                                    id,
                                    types.objectExpression([
                                        types.objectProperty(types.identifier('exports'), types.objectExpression([])),
                                    ])
                                )
                            )
                        );
                        body.unshift(scopeAssign);
                        // replace the require call with the imported value.
                        path.replaceWith(types.memberExpression(id, types.identifier('exports')));
                    } else {
                        id = path.scope.generateUidIdentifierBasedOnNode(modName);
                        let importDecl = types.importDeclaration(
                            [types.importDefaultSpecifier(id)],
                            types.stringLiteral(modName)
                        );

                        // import declaration should be on the top-level of the file.
                        body.unshift(importDecl);
                        // replace the require call with the imported value.
                        path.replaceWith(id);
                    }
                });
            }
            if (globalScope) {
                const importDecl = types.importDeclaration(
                    [types.importDefaultSpecifier(globalScope)],
                    types.stringLiteral(CJS_HELPERS)
                );
                body.unshift(importDecl);
            }
        },
    };
}

function commonExports({ types }) {
    /**
     * Match AST types for ES6 import export.
     * @type {RegExp}
     */
    const IMPORT_EXPORT_DECL_REGEX = /^(?:Import|Export(?:Named|Default|All))Declaration/;
    return {
        visitor: {
            // intercept file top-level.
            Program(path) {
                // check if the file has not ES6 imports/exports. we do not handle mixed mode.
                for (const child of path.node.body) {
                    if (IMPORT_EXPORT_DECL_REGEX.test(child.type)) {
                        // ES6 import/export found, exit.
                        return;
                    }
                }

                // wrap the file defining `module` and `exports` variables.
                const filename = path.hub.file.opts.filename;
                CJS_REQUIRED[filename] = types.identifier(`$$$_${CJS_COUNTER++}`);

                const globalScope = path.scope.generateUidIdentifierBasedOnNode('scope');
                const id = types.memberExpression(globalScope, CJS_REQUIRED[filename]);
                // assign to global scope
                const scopeAssign = types.expressionStatement(
                    types.assignmentExpression(
                        '=',
                        id,
                        types.logicalExpression(
                            '||',
                            id,
                            types.objectExpression([
                                types.objectProperty(types.identifier('exports'), types.objectExpression([])),
                            ])
                        )
                    )
                );
                const importDecl = types.importDeclaration(
                    [types.importDefaultSpecifier(globalScope)],
                    types.stringLiteral(CJS_HELPERS)
                );
                const wrap = types.expressionStatement(
                    types.callExpression(
                        types.functionExpression(null, [types.identifier('module'), types.identifier('exports')], types.blockStatement(path.node.body)),
                        [id, types.memberExpression(id, types.identifier('exports'))]
                    )
                );
                const reexportsId = path.scope.generateUidIdentifierBasedOnNode('exports');
                const interopDefault = types.variableDeclaration(
                    'const',
                    [
                        types.variableDeclarator(
                            reexportsId,
                            types.logicalExpression(
                                '||',
                                types.logicalExpression(
                                    '&&',
                                    types.memberExpression(id, types.identifier('exports')),
                                    types.memberExpression(types.memberExpression(id, types.identifier('exports')), types.identifier('default'))
                                ),
                                types.memberExpression(id, types.identifier('exports'))
                            )
                        ),
                    ]
                );
                // export the defined variables as default.
                const final = types.exportDefaultDeclaration(reexportsId);
                path.node.body = [importDecl, scopeAssign, wrap, interopDefault, final];
            },
        },
    };
}

module.exports = function(options = {}) {
    options = Object.assign({}, options);

    const filter = rollupUtils.createFilter(options.include, options.exclude);
    const filterPolyfills = rollupUtils.createFilter([
        '**/node_modules/core-js/**/*',
        '**/node_modules/regenerator-runtime/**/*',
    ], []);

    delete options.include;
    delete options.exclude;

    return {
        name: 'babel',

        resolveId(id) {
            if (id === BABEL_HELPERS) return id;
            if (id === CJS_HELPERS) return id;
        },

        load(id) {
            if (id === BABEL_HELPERS) {
                return babelCore.buildExternalHelpers(null, 'module');
            }
            if (id === CJS_HELPERS) {
                return 'export default {}';
            }

            return;
        },

        transform(code, id) {
            if (!filter(id)) return null;
            if (id === BABEL_HELPERS) return null;

            let localOpts = Object.assign({
                filename: id,
                sourceMap: true,
            }, options);

            let extraPlugins = [helperPlugin];

            if (code.match(/\b(?:require)\b/)) {
                // add the plugin for `require` transformations.
                extraPlugins.push(commonRequire);
            }

            if (code.match(/\b(?:module|exports)\b/)) {
                // add the plugin for `exports` transformations.
                extraPlugins.push(commonExports);
            }

            if (filterPolyfills(id)) {
                localOpts = Object.assign({}, localOpts, {
                    presets: [],
                    plugins: extraPlugins,
                });
            } else {
                localOpts = Object.assign({}, localOpts, {
                    plugins: (localOpts.plugins || []).concat(extraPlugins),
                });
            }

            const transformed = babelCore.transform(code, localOpts);

            return {
                code: transformed.code,
                map: transformed.map,
            };
        },
    };
};
