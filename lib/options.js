const path = require('path');
const cwd = require('./paths').cwd;
const glob = require('glob');

module.exports = {
    /**
     * Handle the arguments to produce some output.
     *
     * Sounds familiar, huh? It's what every function does…
     *
     * @param {{arguments: Array<string>}} options Command options.
     * @returns {{files: Array<string>, packages: {[x: string]: {name: string, path: string, json: Object}}}}
     */
    handleArguments(options) {
        let projects = require('./packages.js');
        let packages = {};
        Object.keys(projects).forEach((pr) => {
            packages[projects[pr].name] = {
                name: projects[pr].name,
                path: pr,
                json: projects[pr],
            };
        });
        let names = Object.keys(packages);
        let files = [];
        options.arguments
            // Keep only arguments that aren't mentioned in packages.
            .filter((arg) => names.indexOf(arg) === -1)
            // Add their paths to `files` array.
            .forEach((n) => {
                files.push(...glob.sync(path.resolve(cwd, n)));
            });
        if (options.arguments.length) {
            if (options.arguments.length > files.length) {
                // Some arguments are packages.
                let filtered = options.arguments.filter((arg) => names.indexOf(arg) !== -1);
                names.forEach((prName) => {
                    if (filtered.indexOf(prName) === -1) {
                        delete packages[prName];
                    }
                });
            } else {
                // No packages required.
                // Is this needed? The case above should cover this "else" branch as well…
                // Also, if some non-package argument resolves to multiple paths via Glob,
                // this might be a mistake! ~~fquffio
                packages = {};
            }
        }
        return {
            files,
            packages,
        };
    },
};
