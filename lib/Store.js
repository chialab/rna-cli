const path = require('path');
const os = require('os');
const { keypath } = require('@chialab/proteins');
const { NavigatorDirectory } = require('./Navigator');

const HOME_DIR = os.homedir();

class Store extends NavigatorDirectory {
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

module.exports = Store;
