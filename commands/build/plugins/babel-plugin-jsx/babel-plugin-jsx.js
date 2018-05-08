/**
 * Auto import pragma specifier if needed.
 */
function jsx({ types, parse }) {
    /**
     * A list of already handled files.
     * @type {Array<string>}
     * @private
     */
    const HANDLED = [];

    return {
        // extends the default jsx plugin
        inherits: require('@babel/plugin-transform-react-jsx').default,
        visitor: {
            Program(path) {
                // store the Program path
                this.program = path;
            },
            JSXElement(path, state) {
                const filename = path.hub.file.opts.filename;
                const { pragma, moduleName, defaultImport } = state.opts;

                if (!moduleName) {
                    // module name is not specified.
                    return;
                }

                if (HANDLED.includes(filename)) {
                    // file already handled
                    return;
                }

                // add to handled list
                HANDLED.push(filename);

                // detected the first level specifier to use for JSX
                let node = parse(pragma).program.body[0];
                let specifier = node.name;
                if (node.type === 'ExpressionStatement') {
                    node = node.expression;
                    if (node.type === 'MemberExpression') {
                        specifier = node.object.name;
                    }
                }
                // check if the specifier is already defined
                if (this.program.scope.hasBinding(specifier)) {
                    return;
                }

                // import the specifier
                let importDecl = types.importDeclaration(
                    [
                        defaultImport ?
                            types.importDefaultSpecifier(types.identifier(specifier)) :
                            types.importSpecifier(types.identifier(specifier), types.identifier(specifier)),
                    ],
                    types.stringLiteral(moduleName)
                );

                // add the import statement
                this.program.unshiftContainer('body', importDecl);
            },
        },
    };
}

module.exports = jsx;
