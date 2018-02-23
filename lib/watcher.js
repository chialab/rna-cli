const path = require('path');
const chokidar = require('chokidar');
const colors = require('colors/safe');
const cwd = require('./paths.js').cwd;
const md5File = require('md5-file');
const PriorityQueues = require('./PriorityQueues');

/**
 * Turn an absolute path in a relative path, for readability.
 *
 * @param {string} p Path.
 * @returns {string}
 */
function formatPath(p) {
    return p.replace(cwd, '').replace(/^\/*/, '');
}

/**
 * A list of supported watch events.
 */
const SUPPORTED_EVENTS = ['add', 'change', 'unlink'];

/**
 * Check if file is really changed using md5 hash.
 * @param {string} event The fs event.
 * @param {string} p The file changed.
 * @param {Object} [HASHES] The instance of the hashes registry.
 */
function isFileChanged(event, p, HASHES = {}) {
    if (event === 'unlink') {
        delete HASHES[p];
        return true;
    } else {
        // Generate the file md5 hash.
        let hash = md5File.sync(p);
        if (hash !== HASHES[p]) {
            // Store the hash.
            HASHES[p] = md5File.sync(p);
            return true;
        }
    }
    return false;
}

/**
 * Watch files.
 * @param {CLI} app The current instance of CLI.
 * @param {string|Array<string>} files  File (or array of) to watch.
 * @param {Function} callback The callback on file changed.
 * @param {object} options A set of options.
 *
 * @namespace options
 * @property {string} cwd The CWD path for the watcher.
 * @property {number} debounce The number of ms to wait before trigger the event.
 * @property {boolean} log Should log file changes.
 * @property {string|Array<string>} ignored File (or array of) to ignore.
 *
 */
module.exports = (app, files, callback, options = {}) => {
    if (!Array.isArray(files)) {
        files = [files];
    }
    if (options.log !== false) {
        app.log(`${colors.bold('watching files...')} ${files.length < 5 ? colors.grey(`(${files.join(', ')})`) : ''}`);
    }
    // Setup the cwd for chokidar
    options.cwd = options.cwd || cwd;
    if (options.ignored) {
        if (!Array.isArray(options.ignored)) {
            options.ignored = [options.ignored];
        }
    } else {
        options.ignored = [];
    }
    options.ignored.push(/(^|[/\\])\../);
    let ready = false;
    /**
     * Store file md5 hashes.
     * @type {Object}
     */
    const HASHES = {};
    /**
     * Callbacks queues handler.
     * @type PriorityQueues
     */
    const PRIORITY_QUEUES = new PriorityQueues();
    return chokidar.watch(files, options)
        .on('all', (event, p) => {
            // Get absolute path.
            p = path.resolve(cwd, p);
            // Check if changed path is a file, ignores directories.
            if (~SUPPORTED_EVENTS.indexOf(event)) {
                if (ready && isFileChanged(event, p, HASHES)) {
                    // The file contents has changed and the first scan has finished.
                    PRIORITY_QUEUES.tick(p, options.debounce)
                        .then(() => {
                            if (event === 'change') {
                                // File updated.
                                if (options.log !== false) {
                                    app.log(colors.grey(`${formatPath(p)} changed.`));
                                }
                                callback(event, p);
                            } else if (event === 'add') {
                                // New file.
                                if (options.log !== false) {
                                    app.log(colors.grey(`${formatPath(p)} created.`));
                                }
                                callback(event, p);
                            } else if (event === 'unlink') {
                                // File deleted.
                                if (options.log !== false) {
                                    app.log(colors.grey(`${formatPath(p)} removed.`));
                                }
                                callback(event, p);
                            }
                        })
                        .catch(() => {
                            // the same file has changed again.
                        });
                }
            }
        })
        .on('ready', () => {
            // First scan is terminated.
            // Be sure of that.
            setTimeout(() => {
                ready = true;
            }, 500);
        });
};
