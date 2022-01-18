const { dirname } = require('path');
const glob = require('glob');

module.exports = ({ types }) => ({
    visitor: {
        CallExpression(path, { file }) {
            const callee = path.get('callee');
            if (!callee || callee.node.type !== 'Import') {
                return;
            }

            if (!path.get('arguments.0')) {
                return;
            }

            const arg = path.get('arguments.0');
            const node = arg.node;
            if (!node) {
                return;
            }

            const leadingComments = node.leadingComments || [];
            if (leadingComments.length === 0) {
                return;
            }

            const importer = file.opts.filename;
            const webpackInclude = leadingComments.find(comment => comment.value.includes('webpackInclude:'));
            if (!webpackInclude) {
                return;
            }

            const identifier = arg.get('expressions.0');
            if (!identifier) {
                return;
            }

            const identifierValue = identifier.node && identifier.node.name;
            if (!identifierValue) {
                return;
            }

            const webpackExclude = leadingComments.find(comment => comment.value.includes('webpackExclude:'));
            const includeGlob = new RegExp(webpackInclude.value
                .replace(/^\s*webpackInclude:\s*\//, '')
                .replace(/\/\s*$/, ''));

            const excludeGlob = webpackExclude && new RegExp(webpackExclude.value
                .replace(/^\s*webpackExclude:\s*/, '')
                .replace(/\s*$/, ''));

            const files = glob.sync('**/*', {
                cwd: dirname(importer),
            }).filter((file) => file.match(includeGlob) && (!excludeGlob || !file.match(excludeGlob)));

            const replace = types.callExpression(
                types.memberExpression(
                    types.objectExpression(
                        files.map((file) => types.objectProperty(
                            types.stringLiteral(`./${file}`),
                            types.arrowFunctionExpression([], types.callExpression(
                                types.import(),
                                [types.stringLiteral(`./${file}`)],
                            )),
                        )),
                    ),
                    arg.node,
                    true
                ),
                []
            );

            path.replaceWith(replace);
        },
    },
});
