const babelModuleImports = require('@babel/helper-module-imports');
const IMPORTS_TO_ADD = 'importsToAdd';

module.exports = () => ({
    visitor: {
        Program: {
            enter: (path, { file }) => {
                file.set(IMPORTS_TO_ADD, []);
            },
            exit: (path, { file }) => {
                const identifiers = {};
                const imports = file
                    .get(IMPORTS_TO_ADD)
                    .concat()
                    .reverse();
                imports.forEach((imp) => {
                    const identifier = identifiers[imp.moduleName] = identifiers[imp.moduleName] || babelModuleImports.addNamespace(path, imp.moduleName);
                    imp.path.parentPath.replaceWithSourceString(`Promise.resolve(${identifier.name})`);
                });
            },
        },
        Import: {
            enter: (path, { file }) => {
                const moduleName = path.container.arguments[0].extra.rawValue;
                const importsToAdd = file.get(IMPORTS_TO_ADD);
                file.set(IMPORTS_TO_ADD, importsToAdd.concat({
                    moduleName,
                    path,
                }));
            },
        },
    },
});
