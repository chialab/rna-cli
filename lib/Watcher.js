const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const PriorityQueues = require('./PriorityQueues');
const minimatch = require('minimatch');

/**
 * A list of supported watch events.
 */
const SUPPORTED_EVENTS = ['add', 'change', 'unlink'];

let GLOBAL_PROMISE;

/**
 * Turn an absolute path in a relative path, for readability.
 *
 * @param {string} p Path.
 * @returns {string}
 */
function formatPath(p) {
    return p.replace(process.cwd(), '').replace(/^\/*/, '');
}

/**
 * @typedef {Object} WatcherOptions
 * @property {Array|String} ignore A pattern of files to ignore.
 * @property {Number} debounce A timeout time before callback call.
 * @property {Boolean} log Should log file changes.
 */

/**
 * @class Watcher
 * Helper for watching file changes.
 */
module.exports = class Watcher {
    /**
     * Create a Watcher instance.
     * @param {string|Array<string>} directories The directories to watch.
     * @param {WatcherOptions} options Options for the watcher.
     */
    constructor(directories, options = {}) {
        if (!Array.isArray(directories)) {
            directories = [directories];
        }
        this.directories = directories;
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
     * @param {string} file The file to check.
     * @return {boolean}
     */
    shouldIgnore(file) {
        const { ignore } = this.options;

        return ignore.some((ignoreRule) => {
            if (ignoreRule instanceof RegExp) {
                return ignoreRule.test(file);
            }
            if (typeof ignoreRule === 'string') {
                return minimatch(file, ignoreRule);
            }
            if (typeof ignoreRule === 'function') {
                return ignoreRule(file);
            }
            return false;
        });
    }

    /**
     * Start to watch files.
     * @param {Function} callback The function to call on files changes.
     */
    watch(callback) {
        this.close();

        const { log } = this.options;

        this.watchers = this.directories.map((directory) =>
            fs.watch(directory, { recursive: true }, async (event, file) => {
                if (event === 'rename') {
                    if (!fs.existsSync(file)) {
                        event = 'add';
                    } else {
                        event = 'unlink';
                    }
                }
                // Check if changed path is a file, ignores directories.
                if (!SUPPORTED_EVENTS.includes(event)) {
                    return;
                }
                file = path.join(directory, file);
                // Resolve symlinks
                if (fs.existsSync(file)) {
                    file = fs.realpathSync(file);
                }
                // The file contents has changed and the first scan has finished.
                try {
                    if (await this.queues.tick(file, 200)) {
                        // Check if ignored
                        GLOBAL_PROMISE = (async () => {
                            await GLOBAL_PROMISE;

                            if (this.shouldIgnore(file)) {
                                return;
                            }
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
                                console.log(colors.grey(`${formatPath(file)} ${label}.`));
                            }
                            try {
                                await callback(event, file);
                            } catch (err) {
                                // console.error(err);
                            }
                        })();
                    }
                } catch (err) {
                    // the same file has changed again.
                }
            })
        );
    }

    /**
     * Close the watcher.
     * @return {void}
     */
    close() {
        if (this.watchers) {
            this.watchers.forEach((watcher) => {
                watcher.close();
            });
        }
    }
};
