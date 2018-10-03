const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { keypath } = require('@chialab/proteins');
const { cli } = require('./paths.js');
const pkg = require(path.join(cli, 'package.json'));

const HOME_DIR = os.homedir();

class StoreEntry {
    constructor(file) {
        this.path = file;
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

class StoreFile extends StoreEntry {
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

class StoreDirectory extends StoreEntry {
    constructor(directory) {
        super(directory);
        fs.ensureDirSync(this.path);
    }

    file(file) {
        return new StoreFile(path.join(this.path, file));
    }

    directory(directory) {
        return new StoreDirectory(path.join(this.path, directory));
    }
}

class Store extends StoreDirectory {
    constructor(directory) {
        super(path.join(HOME_DIR, '.config', directory));

        this.temporaryPath = this.directory('temp');
        this.temporaryFiles = [];
        this.configFile = this.file('store.json');
        if (!this.configFile.exists()) {
            this.configFile.writeJson({});
        }
        this.config = this.configFile.readJson();

        process.on('exit', () => {
            this.flush();
        });

        process.on('SIGINT', () => {
            this.flush();
            process.exit();
        });
    }

    flush() {
        this.temporaryFiles.forEach((file) => {
            try {
                file.unlink();
            } catch (err) {
                //
            }
        });
    }

    has(path) {
        return keypath.has(this.config, path);
    }

    get(path) {
        return keypath.get(this.config, path);
    }

    set(path, value) {
        keypath.set(this.config, path, value);
        this.configFile.writeJson(this.config);
    }

    tmpfile(file) {
        let ref = this.temporaryPath.file(temporaryRename(file));
        this.temporaryFiles.push(ref);
        return ref;
    }

    tmpdir(directory) {
        let ref = this.temporaryPath.file(temporaryRename(directory));
        this.temporaryFiles.push(ref);
        return ref;
    }
}

function temporaryRename(file) {
    let dirName = path.dirname(file);
    let extName = path.extname(file);
    let baseName = path.basename(file, extName);
    return path.join(dirName, `${baseName}.${Date.now()}${extName || ''}`);
}

module.exports = new Store(pkg.name.split('/').pop());
