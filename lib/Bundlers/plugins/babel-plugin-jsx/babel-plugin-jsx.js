/**
 * Auto import pragma specifier if needed.
 */
function jsx({ types, parse }) {
    /**
     * A list of already handled files.
     * @type {boolean}
     * @private
     */
    let HANDLED;

    return {
        name: 'transform-jsx',
        // extends the default jsx plugin
        inherits: require('@babel/plugin-transform-react-jsx').default,
        visitor: {
            Program(path) {
                HANDLED = false;
                // store the Program path
                this.program = path;
            },
            JSXElement(path, state) {
                const { pragma, pragmaFrag, import: source, pragmaDefault } = state.opts;

                if (!source) {
                    // module name is not specified.
                    return;
                }

                if (HANDLED) {
                    // file already handled
                    return;
                }

                // add to handled list
                HANDLED = true;

                // detected the first level specifier to use for JSX
                let pragmaSpecifier;
                let pragmaNode = parse(pragma).program.body[0];
                if (pragmaNode.type === 'ExpressionStatement') {
                    if (pragmaNode.expression.type === 'MemberExpression') {
                        pragmaSpecifier = pragmaNode.expression.object.name;
                    } else if (pragmaNode.expression.type === 'Identifier') {
                        pragmaSpecifier = pragmaNode.expression.name;
                    }
                }
                let pragmaFragSpecifier;
                if (pragmaFrag) {
                    let pragmaFragNode = parse(pragmaFrag).program.body[0];
                    if (pragmaFragNode.type === 'ExpressionStatement') {
                        if (pragmaFragNode.expression.type === 'MemberExpression') {
                            pragmaFragSpecifier = pragmaFragNode.expression.object.name;
                        } else if (pragmaFragNode.expression.type === 'Identifier') {
                            pragmaFragSpecifier = pragmaFragNode.expression.name;
                        }
                    }
                }

                let specifiers = [];
                if (pragmaSpecifier && !this.program.scope.hasBinding(pragmaSpecifier)) {
                    specifiers.push(
                        pragmaDefault ?
                            types.importDefaultSpecifier(types.identifier(pragmaSpecifier)) :
                            types.importSpecifier(types.identifier(pragmaSpecifier), types.identifier(pragmaSpecifier)),
                    );
                }
                if (pragmaFragSpecifier && !this.program.scope.hasBinding(pragmaFragSpecifier)) {
                    specifiers.push(
                        types.importSpecifier(types.identifier(pragmaFragSpecifier), types.identifier(pragmaFragSpecifier)),
                    );
                }

                if (specifiers.length === 0) {
                    return;
                }

                // import the specifier
                let importDecl = types.importDeclaration(specifiers, types.stringLiteral(source));

                // add the import statement
                this.program.unshiftContainer('body', importDecl);
            },
        },
    };
}

module.exports = jsx;
