const path = require('path');
const chokidar = require('chokidar');
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
    constructor(options = {}) {
        this.files = [];
        if (options.ignored) {
            if (!Array.isArray(options.ignored)) {
                options.ignored = [options.ignored];
            }
        } else {
            options.ignored = [];
        }
        options.ignored.push(/(^|[/\\])\../);
        options.ignoreInitial = true;
        this.options = options;
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
     */
    watch(callback) {
        this.close();
        const { cwd, debounce, log } = this.options;

        let promise = Promise.resolve();
        this.watcher = chokidar.watch(this.files, this.options)
            .on('all', async(event, p) => {
                // Get absolute path.
                p = path.resolve(cwd, p);
                // Check if changed path is a file, ignores directories.
                if (!SUPPORTED_EVENTS.includes(event)) {
                    return;
                }
                // The file contents has changed and the first scan has finished.
                try {
                    if (await this.queues.tick(p, debounce)) {
                        promise = promise.then(async() => {
                            if (log !== false) {
                                let label;
                                switch (event) {
                                    case 'add':
                                        label = 'created';
                                        break;
                                    case 'unlink':
                                        label = 'removed';
                                        break;
                                    default:
                                        label = 'changed';
                                }
                                // eslint-disable-next-line
                                console.log(colors.grey(`${formatPath(cwd, p)} ${label}.`));
                            }
                            try {
                                await callback(event, p);
                            } catch (err) {
                                //
                            }
                        });
                    }
                } catch (err) {
                    // the same file has changed again.
                }
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
};
