const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const crypto = require('crypto');
const colors = require('colors/safe');
const PriorityQueues = require('./PriorityQueues');
const glob = require('glob');

/**
 * A list of supported watch events.
 */
const SUPPORTED_EVENTS = ['add', 'change', 'unlink'];

/**
 * Turn an absolute path in a relative path, for readability.
 *
 * @param {string} p Path.
 * @returns {string}
 */
function formatPath(cwd, p) {
    return p.replace(cwd, '').replace(/^\/*/, '');
}

/**
 * @typedef {Object} WatcherOptions
 * @property {Array|String} ignored A pattern of files to ignore.
 * @property {Number} debounce A timeout time before callback call.
 * @property {Boolean} log Should log file changes.
 * @property {String} cwd The base path of watching files.
 */

/**
 * @class Watcher
 * Helper for watching file changes.
 */
module.exports = class Watcher {
    /**
     * Create a Watcher instance.
     * @param {WatcherOptions} options Options for the watcher.
     */
    constructor(options) {
        this.files = [];
        if (options.ignored) {
            if (!Array.isArray(options.ignored)) {
                options.ignored = [options.ignored];
            }
        } else {
            options.ignored = [];
        }
        options.ignored.push(/(^|[/\\])\../);
        this.options = options || {};
        this.hashes = {};
        this.queues = new PriorityQueues();
    }

    /**
     * Add files to the watched list.
     * @param {String|Array<String>} files New files to watch.
     * @return {void}
     */
    add(files) {
        if (!Array.isArray(files)) {
            files = [files];
        }
        const { cwd } = this.options;
        files.forEach((pattern) => {
            // resolve glob patterns.
            const globFiles = glob.sync(pattern, {
                cwd,
            });
            globFiles.forEach((file) => {
                if (this.files.indexOf(file) === -1) {
                    // The file is a new entry for the watcher.
                    this.files.push(file);
                    if (fs.statSync(file).isFile()) {
                        this.updateHash(file);
                    }
                    if (this.watcher) {
                        // Start to watch new file.
                        this.watcher.add(file);
                    }
                }
            });
        });
    }

    /**
     * Start to watch files.
     * @param {Function} callback The function to call on files changes.
     * @return {Promise} Resolves when watcher is ready.
     */
    async watch(callback) {
        this.close();
        let ready = false;
        const { cwd, debounce, log } = this.options;
        return await new global.Promise((resolve) => {
            this.watcher = chokidar.watch(this.files, this.options)
                .on('all', async(event, p) => {
                    // Get absolute path.
                    p = path.resolve(cwd, p);
                    // Check if changed path is a file, ignores directories.
                    if (~SUPPORTED_EVENTS.indexOf(event)) {
                        if (ready && (event === 'unlink' || this.hasChanges(p))) {
                            // The file contents has changed and the first scan has finished.
                            try {
                                await this.queues.tick(p, debounce);
                                if (event === 'change') {
                                    // File updated.
                                    if (log !== false) {
                                        // eslint-disable-next-line
                                        console.log(colors.grey(`${formatPath(cwd, p)} changed.`));
                                    }
                                    callback(event, p);
                                } else if (event === 'add') {
                                    // New file.
                                    if (log !== false) {
                                        // eslint-disable-next-line
                                        console.log(colors.grey(`${formatPath(cwd, p)} created.`));
                                    }
                                    callback(event, p);
                                } else if (event === 'unlink') {
                                    // File deleted.
                                    if (log !== false) {
                                        // eslint-disable-next-line
                                        console.log(colors.grey(`${formatPath(cwd, p)} removed.`));
                                    }
                                    callback(event, p);
                                }
                            } catch(err) {
                                // the same file has changed again.
                            }
                        }
                    }
                })
                .on('ready', () => {
                    // First scan is terminated.
                    // Be sure of that.
                    setTimeout(() => {
                        ready = true;
                        resolve();
                    }, 500);
                });
        });
    }

    /**
     * Close the watcher.
     * @return {void}
     */
    close() {
        if (this.watcher) {
            this.watcher.close();
        }
    }

    /**
     * Create a MD5 file hash.
     * @param {String} file The path of the file.
     * @return {String}
     */
    hash(file) {
        return crypto.createHash('md5')
            .update(fs.readFileSync(file, 'utf8'), 'utf8')
            .digest('hex');
    }

    /**
     * Check if file is really changed using md5 hash.
     * @param {string} file The file changed.
     */
    hasChanges(file) {
        if (fs.statSync(file).isFile()) {
            // Generate the file md5 hash.
            let hash = this.hash(file);
            if (hash !== this.hashes[file]) {
                // Store the hash.
                this.updateHash(file);
                return true;
            }
        }
        return false;
    }

    /**
     * Update the hash reference for a file.
     * @private
     * @param {String} file The path of the file.
     * @return {void}
     */
    updateHash(file) {
        this.hashes[file] = this.hash(file);
    }
};
