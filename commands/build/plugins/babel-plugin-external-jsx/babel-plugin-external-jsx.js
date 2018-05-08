/* eslint-env node */

/**
 * Check if a path is in the include/exclude list.
 * @private
 *
 * @param {Array<string|RegExp|Function>} list List of exclusion rules.
 * @param {string} fileName The path to check.
 * @return {Boolean}
 */
function filter(list, fileName) {
    return !!list.find((rule) => {
        if (typeof rule === 'string') {
            return rule === fileName;
        }
        if (rule instanceof RegExp) {
            return rule.test(fileName);
        }
        if (typeof rule === 'function') {
            return rule(fileName);
        }
    });
}

/**
 * Auto add export declaration for jsx files.
 */
function externalJSX({ types }) {
    return {
        visitor: {
            Program(path, state) {
                const opts = state.opts;
                const include = opts.include || [];
                const exclude = opts.exclude || [];
                const filename = path.hub.file.opts.filename;
                if (include.length && !filter(include, filename)) {
                    // excluded by plugin options
                    return;
                }
                if (exclude.length && filter(exclude, filename)) {
                    // excluded by plugin options
                    return;
                }
                const body = path.get('body');

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
