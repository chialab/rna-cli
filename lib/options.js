const path = require('path');
const cwd = require('./paths').cwd;
const glob = require('glob');

module.exports = {
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
            .filter((arg) => names.indexOf(arg) === -1)
            .forEach((n) => {
                files.push(...glob.sync(path.resolve(cwd, n)));
            });
        if (options.arguments.length) {
            if (options.arguments.length - files.length > 0) {
                let filtered = options.arguments.filter((arg) => names.indexOf(arg) !== -1);
                names.forEach((prName) => {
                    if (filtered.indexOf(prName) === -1) {
                        delete packages[prName];
                    }
                });
            } else {
                packages = {};
            }
        }
        return {
            files,
            packages,
        };
    },
};