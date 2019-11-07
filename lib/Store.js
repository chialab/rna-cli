const path = require('path');
const os = require('os');
const { keypath } = require('@chialab/proteins');
const { Directory } = require('./File');

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
 * @class Store
 * An helper for CLI persistent configurations and temporary files.
 */
class Store extends Directory {
    /**
     * Create a Store.
     * @param {string} name The CLI package name.
     * @return {Store}
     */
    constructor(name) {
        super(path.join(CONFIG_DIR, name));

        // create the store.json file for configurations.
        this.configFile = this.file('store.json');
        if (!this.configFile.exists()) {
            this.configFile.writeJson({});
        }
        this.config = this.configFile.readJson();
    }

    /**
     * Get a shallow clone of the config object.
     * @return {Object}
     */
    toJSON() {
        return JSON.parse(JSON.stringify(this.config));
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
     * Remove a configuration value.
     * @param {string} path The object path to remove.
     * @return {void}
     */
    remove(path) {
        keypath.del(this.config, path);
        this.configFile.writeJson(this.config);
    }
}

module.exports = Store;
