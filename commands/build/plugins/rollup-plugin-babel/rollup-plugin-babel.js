const rollupUtils = require('rollup-pluginutils');
const babelCore = require('@babel/core');
const babelModuleImports = require('@babel/helper-module-imports');
const isCore = require('resolve').isCore;

const HELPERS = 'rollupPluginBabelHelpers';

function helperPlugin() {
    return {
        pre(file) {
            const cachedHelpers = {};
            file.set('helperGenerator', name => {
                if (cachedHelpers[name]) {
                    return cachedHelpers[name];
                }
                return (cachedHelpers[name] = babelModuleImports.addNamed(file.path, name, HELPERS));
            });
        },
    };
}

function commonPlugin({ types }) {
    /**
     * Match AST types for ES6 import export.
     * @type {RegExp}
     */
    const IMPORT_EXPORT_DECL_REGEX = /^(?:Import|Export(?:Named|Default|All))Declaration/;
    return {
        visitor: {
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

                if (isCore(node.arguments[0].type)) {
                    return;
                }

                // create an ES6 import declaration.
                let modName = node.arguments[0].value;
                let id = path.scope.generateUidIdentifierBasedOnNode(modName);
                let importDecl = types.importDeclaration(
                    [types.importDefaultSpecifier(id)],
                    types.stringLiteral(modName)
                );
                // replace the require call with the imported value.
                path.replaceWith(id);

                // import declaration should be on the top-level of the file.
                let program = path.hub.file.path;
                program.node.body.unshift(importDecl);
            },
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
                const id = path.scope.generateUidIdentifierBasedOnNode('module');
                const exportsId = types.identifier('exports');
                const mod = types.objectExpression([
                    types.objectProperty(exportsId, types.objectExpression([])),
                ]);
                const decl = new types.variableDeclaration('let', [
                    types.variableDeclarator(id, mod),
                ]);
                const wrap = types.expressionStatement(
                    types.callExpression(
                        types.functionExpression(null, [types.identifier('module'), exportsId], types.blockStatement(path.node.body)),
                        [id, types.memberExpression(id, exportsId)]
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
                                types.memberExpression(types.memberExpression(id, exportsId), types.identifier('default')),
                                types.memberExpression(id, exportsId)
                            )
                        ),
                    ]
                );
                // export the defined variables as default.
                const final = types.exportDefaultDeclaration(reexportsId);
                path.node.body = [decl, wrap, interopDefault, final];
            },
        },
    };
}

module.exports = function(options = {}) {
    options = Object.assign({}, options);

    const filter = rollupUtils.createFilter(options.include, options.exclude);
    delete options.include;
    delete options.exclude;

    return {
        name: 'babel',

        resolveId(id) {
            if (id === HELPERS) return id;
        },

        load(id) {
            if (id !== HELPERS) {
                return;
            }

            return babelCore.buildExternalHelpers(null, 'module');
        },

        transform(code, id) {
            if (!filter(id)) return null;
            if (id === HELPERS) return null;

            let localOpts = Object.assign({
                filename: id,
                sourceMap: true,
            }, options);

            let extraPlugins = [helperPlugin];

            if (code.match(/\b(?:require|module|exports)\b/)) {
                // add the plugin for `require` transformations.
                extraPlugins.push(commonPlugin);
            }

            localOpts = Object.assign({}, localOpts, {
                plugins: (localOpts.plugins || []).concat(extraPlugins),
            });

            const transformed = babelCore.transform(code, localOpts);

            return {
                code: transformed.code,
                map: transformed.map,
            };
        },
    };
};
