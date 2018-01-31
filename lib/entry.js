const fs = require('fs-extra');
const path = require('path');
const cwd = require('./paths').cwd;
const glob = require('glob');

class Entry {
    /**
     * Handle the arguments to produce some output.
     *
     * Sounds familiar, huh? It's what every function does…
     *
     * @param {Array<string>} args Command arguments.
     * @returns {Array<Entry>}
     */
    static resolve(args, ignore = 'node_modules/**/*') {
        if (!Array.isArray(args)) {
            args = [args];
        }
        // get all package names.
        let packages = Object.values(require('./packages.js')).map((pr) => pr.name);
        let entries = [];
        args.forEach((file) => {
            let isModuleDir = fs.existsSync(path.join(file, 'package.json'));
            if (!isModuleDir && packages.indexOf(file) === -1) {
                // file entry
                glob.sync(path.resolve(cwd, file), { ignore: path.resolve(cwd, ignore) }).forEach((file) => {
                    entries.push(new Entry(file));
                });
            } else {
                // package entry
                entries.push(new PackageEntry(file));
            }
        });
        return entries;
    }

    constructor(entryPath) {
        if (fs.existsSync(entryPath)) {
            this.loadFile(entryPath);
            this.loadPackage(entryPath);
        } else {
            throw new Error(`Could not resolve entry for "${entryPath}".`);
        }
    }

    loadFile(entryPath) {
        this.file = {
            path: entryPath,
        };
    }

    loadPackage(entryPath) {
        let parentDir = entryPath;
        while (parentDir && parentDir !== '/') {
            let jsonPath = path.join(parentDir, 'package.json');
            if (fs.existsSync(jsonPath)) {
                let json = require(jsonPath);
                this.package = {
                    name: json.name,
                    path: parentDir,
                    json,
                };
                return;
            }
            parentDir = path.dirname(parentDir);
        }
    }
}

class PackageEntry extends Entry {
    loadFile() {}
}

module.exports = Entry;
