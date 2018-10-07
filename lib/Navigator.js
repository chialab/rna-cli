const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

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

    get localPath() {
        if (this.cwd) {
            return path.relative(this.cwd, this.path);
        }
        return this.path;
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
    ensureExists() {
        fs.ensureDirSync(this.path);
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
}

module.exports = {
    NavigatorEntry,
    NavigatorFile,
    NavigatorDirectory,
};
