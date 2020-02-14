const babelModuleImports = require('@babel/helper-module-imports');
const CHAI_LIB = require.resolve('chai/chai', {
    paths: [__dirname],
});

/**
 * Polyfill assetion statements with chai.
 */
function assertionsPlugin({ types }) {
    return {
        name: 'transform-assertions',
        visitor: {
            Identifier(path) {
                const filename = path.hub && path.hub.file.opts.filename;
                if (filename === CHAI_LIB) {
                    return;
                }

                const name = path.node.name;

                if (!(['assert', 'expect', 'should'].includes(name))) {
                    return;
                }

                if (path.parentPath.isMemberExpression() &&
                    path.parentPath.get('object') !== path) {
                    return;
                }

                if (path.parentPath.isExportSpecifier() &&
                    path.parentPath.get('local') !== path) {
                    return;
                }

                let parent = path;
                while (parent) {
                    if (parent.scope.hasOwnBinding(name)) {
                        return;
                    }
                    parent = parent.parentPath;
                }

                const id = (() => {
                    if (!this.chai) {
                        this.chai = babelModuleImports.addDefault(path.hub.file.path, CHAI_LIB, { nameHint: 'chai' });
                    }
                    return this.chai;
                })();

                path.replaceWith(
                    types.memberExpression(id, path.node)
                );
            },
        },
    };
}

module.exports = assertionsPlugin;
