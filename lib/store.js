const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { keypath } = require('@chialab/proteins');
const { cli } = require('./paths.js');
const pkg = require(path.join(cli, 'package.json'));

const HOME_DIR = os.homedir();

class StoreFile {
    constructor(filePath) {
        this.path = filePath;
    }

    exists() {
        return fs.existsSync(this.path);
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

    unlink() {
        if (this.exists()) {
            fs.unlinkSync(this.path);
        }
    }

    readJson() {
        let data = this.read();
        if (data) {
            data = JSON.parse(data);
        }
        return data;
    }

    writeJson(data) {
        this.writeFile(JSON.stringify(data, null, 2));
    }
}

class TemporaryStoreFile extends StoreFile {
    constructor(filePath) {
        let dirName = path.dirname(filePath);
        let extName = path.extname(filePath);
        let baseName = path.basename(filePath, extName);
        super(path.join(dirName, `${baseName}.${Date.now()}${extName}`));

        process.on('exit', () => {
            try {
                this.unlink();
            } catch (err) {
                //
            }
        });

        process.on('SIGINT', () => {
            try {
                this.unlink();
            } catch (err) {
                //
            }
            process.exit();
        });
    }
}

class Store {
    constructor(name, configFileName = 'store.json') {
        this.path = path.join(HOME_DIR, '.config', name);
        this.tmpPath = path.join(this.path, 'temp');
        fs.ensureDirSync(this.path);
        fs.ensureDirSync(this.tmpPath);

        this.configFile = new StoreFile(path.join(this.path, configFileName));
        if (!this.configFile.exists()) {
            this.configFile.writeJson({});
        }
        this.config = this.configFile.readJson();
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

    file(file) {
        return new StoreFile(path.join(this.path, file));
    }

    tmpfile(file) {
        return new TemporaryStoreFile(path.join(this.tmpPath, file));
    }
}

module.exports = new Store(pkg.name.split('/').pop());
