const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { keypath } = require('@chialab/proteins');
const { cli } = require('./paths.js');
const pkg = require(path.join(cli, 'package.json'));

const HOME_DIR = os.homedir();

class Store {
    constructor(name, configFileName = 'store.json') {
        this.path = path.join(HOME_DIR, '.config', name);
        this.configFileName = configFileName;
        this.configFile = path.join(this.path, this.configFileName);
        if (!fs.existsSync(this.configFile)) {
            this.writeJson(this.configFileName, {});
        }
        this.config = require(this.configFile);
    }

    has(path) {
        return keypath.has(this.config, path);
    }

    get(path) {
        return keypath.get(this.config, path);
    }

    set(path, value) {
        keypath.set(this.config, path, value);
        this.writeJson(this.configFileName, this.config);
    }

    file(file) {
        return path.join(this.path, file);
    }

    readFile(file) {
        file = this.file(file);
        try {
            return fs.readFileSync(file, 'utf8');
        } catch (err) {
            return null;
        }
    }

    writeFile(file, content) {
        file = this.file(file);
        fs.ensureDirSync(path.dirname(file));
        fs.writeFileSync(file, content);
    }

    readJson(file) {
        let data = this.readFile(file);
        if (data) {
            data = JSON.parse(data);
        }
        return data;
    }

    writeJson(file, data) {
        this.writeFile(file, JSON.stringify(data, null, 2));
    }
}

module.exports = new Store(pkg.name.split('/').pop());
