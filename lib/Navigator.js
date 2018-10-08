const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const gzipSize = require('gzip-size');

class NavigatorEntry {
    constructor(file, cwd) {
        this.path = file;
        this.cwd = cwd;
    }

    get basename() {
        return path.basename(this.path);
    }

    get extname() {
        return path.extname(this.path);
    }

    get dirname() {
        return path.dirname(this.path);
    }

    get size() {
        return {
            size: fs.statSync(this.path).size,
            zipped: gzipSize.sync(this.path),
        };
    }

    get localPath() {
        if (this.cwd) {
            return path.relative(this.cwd, this.path);
        }
        return this.path;
    }

    relative(file) {
        return path.relative(this.path, file);
    }

    isFile() {
        return fs.statSync(this.path).isFile();
    }

    isDirectory() {
        return fs.statSync(this.path).isDirectory();
    }

    exists() {
        return fs.existsSync(this.path);
    }

    unlink() {
        if (this.exists()) {
            fs.removeSync(this.path);
        }
    }
}

class NavigatorFile extends NavigatorEntry {
    get mapFile() {
        return new NavigatorFile(`${this.path}.map`, this.cwd || this.path);
    }

    read() {
        try {
            return fs.readFileSync(this.path, 'utf8');
        } catch (err) {
            return null;
        }
    }

    write(content) {
        fs.ensureDirSync(path.dirname(this.path));
        fs.writeFileSync(this.path, content);
    }

    readJson() {
        let data = this.read();
        if (data) {
            data = JSON.parse(data);
        }
        return data;
    }

    writeJson(data) {
        this.write(JSON.stringify(data, null, 2));
    }
}

class NavigatorDirectory extends NavigatorEntry {
    ensure() {
        fs.ensureDirSync(this.path);
    }

    empty() {
        fs.emptyDirSync(this.path);
    }

    resolve(patterns) {
        let files = [];
        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }

        patterns.forEach((pattern) => {
            glob.sync(pattern, {
                cwd: this.path,
                absolute: true,
            }).forEach((file) => {
                if (!files.includes(file)) {
                    files.push(file);
                }
            });
        });

        return files.map((file) => {
            let stats = fs.statSync(file);
            if (stats.isDirectory()) {
                return new NavigatorDirectory(file, this.cwd);
            } else if (stats.isFile()) {
                return new NavigatorFile(file, this.cwd);
            }
        }).filter(Boolean);
    }

    entry(file) {
        return new NavigatorEntry(path.resolve(this.path, file), this.cwd || this.path);
    }

    file(file) {
        return new NavigatorFile(path.resolve(this.path, file), this.cwd || this.path);
    }

    directory(directory) {
        return new NavigatorDirectory(path.resolve(this.path, directory), this.cwd || this.path);
    }

    children() {
        if (!this.exists()) {
            return null;
        }

        let children = fs.readdirSync(this.path);
        return children.map((file) => {
            let entry = this.entry(file);
            if (entry.isDirectory()) {
                return this.directory(file);
            }
            return this.file(file);
        });
    }

    files() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isFile());
    }

    directories() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isDirectory());
    }
}

module.exports = {
    NavigatorEntry,
    NavigatorFile,
    NavigatorDirectory,
};