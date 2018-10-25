const path = require('path');
const os = require('os');
const { keypath } = require('@chialab/proteins');
const { NavigatorDirectory } = require('./Navigator');

/**
 * The user home directory.
 * @type {string}
 */
const HOME_DIR = os.homedir();

/**
 * The user temp directory.
 * @type {string}
 */
const CONFIG_DIR = path.join(HOME_DIR, '.config');

/**
 * The user temp directory.
 * @type {string}
 */
const TMP_DIR = (() => {
    switch (os.platform()) {
        case 'darwin':
            return path.join(HOME_DIR, 'Library', 'Caches');
        case 'win32':
            return process.env.APPDATA;
    }
    return path.join(HOME_DIR, '.cache');
})();

/**
 * @class Store
 * An helper for CLI persistent configurations and temporary files.
 */
class Store extends NavigatorDirectory {
    /**
     * Create a Store.
     * @param {string} name The CLI package name.
     * @return {Store}
     */
    constructor(name) {
        super(path.join(CONFIG_DIR, name));

        // create a path for temporary files.
        this.temporaryPath = new NavigatorDirectory(path.join(TMP_DIR, name));
        this.temporaryPath.ensure();
        this.temporaryFiles = [];

        // create the store.json file for configurations.
        this.configFile = this.file('store.json');
        if (!this.configFile.exists()) {
            this.configFile.writeJson({});
        }
        this.config = this.configFile.readJson();

        // remove temporaty files on process exit.
        process.on('exit', () => {
            this.flush();
        });
    }

    /**
     * Clean up temporary files.
     * @return {void}
     */
    flush() {
        this.temporaryFiles.forEach((file) => {
            try {
                file.unlink();
            } catch (err) {
                //
            }
        });
    }

    /**
     * Check if the store has a configuration set.
     * @param {string} path The object path to check.
     * @return {boolean}
     */
    has(path) {
        return keypath.has(this.config, path);
    }

    /**
     * Get a configuration value.
     * @param {string} path The object path to retrieve.
     * @return {*} The actual value for the given path.
     */
    get(path) {
        return keypath.get(this.config, path);
    }

    /**
     * Set a configuration value.
     * @param {string} path The object path to update.
     * @param {*} value The value to store.
     * @return {void}
     */
    set(path, value) {
        keypath.set(this.config, path, value);
        this.configFile.writeJson(this.config);
    }

    /**
     * Create a temporary file reference.
     * @param {string} file The file name.
     * @return {NavigatorFile} The file reference in the tmp directory.
     */
    tmpfile(file) {
        // rename the file using a time hash.
        let ref = this.temporaryPath.file(temporaryRename(file));
        this.temporaryFiles.push(ref);
        return ref;
    }

    /**
     * Create a temporary directory reference.
     * @param {string} directory The directory name.
     * @return {NavigatorDirectory} The directory reference in the tmp directory.
     */
    tmpdir(directory) {
        // rename the directory using a time hash.
        let ref = this.temporaryPath.file(temporaryRename(directory));
        this.temporaryFiles.push(ref);
        return ref;
    }
}

/**
 * Create a temporary name for a file using a time hash.
 * @private
 * @param {string} file The original filename.
 * @return {string} The modified filename.
 */
function temporaryRename(file) {
    let dirName = path.dirname(file);
    let extName = path.extname(file);
    let baseName = path.basename(file, extName);
    return path.join(dirName, `${baseName}.${Date.now()}${extName || ''}`);
}

module.exports = Store;
