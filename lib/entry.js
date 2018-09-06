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
    static resolve(dir, args, ignore = 'node_modules/**/*') {
        if (!Array.isArray(args)) {
            args = [args];
        }
        // get all package names.
        let cwdEntry = new PackageEntry(dir);
        let entries = [];
        if (cwdEntry.isMonorepo()) {
            entries = cwdEntry.getMonorepos();
            if (args.length === 0) {
                return entries;
            }
            entries = entries.filter((pkgEntry) => args.includes(pkgEntry.package.name));
        } else if (args.length === 0) {
            return [cwdEntry];
        }
        args.forEach((file) => {
            let isModuleDir = fs.existsSync(path.join(file, 'package.json'));
            if (!isModuleDir) {
                // file entry
                glob.sync(path.resolve(cwd, file), { ignore: path.resolve(cwd, ignore) }).forEach((file) => {
                    entries.push(new Entry(file));
                });
            } else {
                // package entry
                entries.push(new PackageEntry(path.resolve(cwd, file)));
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
    loadFile() { }

    isMonorepo() {
        return this.package && this.package.json.hasOwnProperty('workspaces');
    }

    getMonorepos() {
        let res = [];
        this.package.json.workspaces.forEach((ws) => {
            res.push(...glob.sync(path.join(this.package.path, ws)));
        });
        return res
            .map((entry) => new PackageEntry(entry))
            .sort((entry1, entry2) => {
                let dep1 = Object.keys(entry1.package.json.dependencies || {});
                let dep2 = Object.keys(entry2.package.json.dependencies || {});
                if (dep1.includes(entry2.package.name)) {
                    return 1;
                }

                if (dep2.includes(entry1.package.name)) {
                    return -1;
                }

                return 0;
            });
    }
}

module.exports = Entry;
