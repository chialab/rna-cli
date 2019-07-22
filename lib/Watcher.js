const minimatch = require('minimatch');
const chokidar = require('chokidar');
const { EventEmitter } = require('events');
const PriorityQueues = require('./PriorityQueues');

let GLOBAL_PROMISE;

/**
 * @typedef {Object} WatcherOptions
 * @property {Array|String} ignore A pattern of files to ignore.
 * @property {Number} debounce A timeout time before callback call.
 */

/**
 * @class Watcher
 * Helper for watching file changes.
 * Use the chokidar package instead of native fs.watch for some reasons.
 * @see https://github.com/paulmillr/chokidar#why
 */
class Watcher extends EventEmitter {
    /**
     * Create a Watcher instance.
     * @param {Directory} directory The directory to watch.
     * @param {WatcherOptions} options Options for the watcher.
     */
    constructor(directory, options = {}) {
        super();
        this.directory = directory;
        if (options.ignore) {
            if (!Array.isArray(options.ignore)) {
                options.ignore = [options.ignore];
            }
        } else {
            options.ignore = [];
        }
        options.ignore.push(/(^|[/\\])\../);
        this.options = options;
        this.queues = new PriorityQueues();
    }

    /**
     * Check if a file is ignored by the watcher.
     *
     * @param {File} file The file to check.
     * @return {boolean}
     */
    shouldIgnore(file) {
        const { ignore } = this.options;

        return ignore.some((ignoreRule) => {
            if (ignoreRule instanceof RegExp) {
                return ignoreRule.test(file.path);
            }
            if (typeof ignoreRule === 'string') {
                return minimatch(file.path, ignoreRule);
            }
            if (typeof ignoreRule === 'function') {
                return ignoreRule(file.path);
            }
            return false;
        });
    }

    /**
     * Start to watch files.
     * @param {Function} callback The function to call on files changes.
     */
    async watch(callback) {
        this.close();
        let ready = false;
        let map = new Map();

        const onChange = async (filePath) => {
            let file = this.directory.entry(filePath);
            let hash = null;
            if (file.exists() && file.isFile()) {
                file = this.directory.file(filePath);
                hash = file.hash();
            }
            if (!ready) {
                map.set(file.path, hash);
                return;
            }
            // Check that the file is already changed.
            if (map.get(file.path) === hash) {
                return;
            }
            // update the hash map.
            map.set(file.path, hash);
            // The file contents has changed and the first scan has finished.
            try {
                // check if there is already a debounced callback for the file.
                if (await this.queues.tick(file.path, 200)) {
                    GLOBAL_PROMISE = (async () => {
                        await GLOBAL_PROMISE;

                        // Check if ignored
                        if (this.shouldIgnore(file)) {
                            return;
                        }

                        this.emit('change', file);

                        try {
                            await callback(file);
                        } catch (err) {
                            // console.error(err);
                        }
                    })();
                }
            } catch (err) {
                // the same file has changed again.
            }
        };

        return new Promise((resolve) => {
            this.watcher = chokidar.watch(this.directory.path, {
                ignoreInitial: false,
                followSymlinks: true,
                cwd: this.directory.path,
                recursive: true,
            })
                .on('add', onChange)
                .on('change', onChange)
                .on('unlink', onChange)
                .on('ready', () => {
                    ready = true;
                    resolve();
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
}

module.exports = Watcher;
