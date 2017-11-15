const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const colors = require('colors/safe');
const cwd = require('./paths.js').cwd;
const wait = require('./watch-queue.js');
const md5File = require('md5-file');

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
 * Queue.
 *
 * @var {Promise}
 */
let q = global.Promise.resolve();

/**
 * Add a job to queue.
 *
 * @param {Function} callback The callback to call.
 * @param {Array} args Watch arguments.
 * @returns {Promise}
 */
function queue(callback, args) {
    // Add something to do in queue.
    q = q.then(() => {
        let res;
        try {
            res = callback(...args);
            // if the response is not a promise, wrap it.
            if (!(res instanceof global.Promise)) {
                res = global.Promise.resolve(res);
            }
        } catch (err) {
            // if the callback is not async, catch any error and resolve the queue.
            res = global.Promise.resolve();
        }
        res = res.catch(() => global.Promise.resolve()); // Ignore errors.
        return res;
    });
    return q;
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
    /**
     * Store file md5 hashes.
     * @type {Object}
     */
    const hashes = {};
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
    return chokidar.watch(files, options)
        .on('all', (event, p) => {
            // Get absolute path.
            p = path.resolve(cwd, p);
            // Check if changed path is a file, ignores directories.
            if (fs.statSync(p).isFile()) {
                // Generate the file md5 hash.
                let hash = md5File.sync(p);
                if (ready && hash !== hashes[p]) {
                    // The file contents has changed and the first scan has finished.
                    wait(p, options.debounce).then(() => {
                        if (event === 'change') {
                            // File updated.
                            if (options.log !== false) {
                                app.log(colors.grey(`${formatPath(p)} changed.`));
                            }
                            queue(callback, [event, p]);
                        } else if (event === 'add') {
                            // New file.
                            if (options.log !== false) {
                                app.log(colors.grey(`${formatPath(p)} created.`));
                            }
                            queue(callback, [event, p]);
                        } else if (event === 'unlink') {
                            // File deleted.
                            if (options.log !== false) {
                                app.log(colors.grey(`${formatPath(p)} removed.`));
                            }
                            queue(callback, [event, p]);
                        }
                    });
                }
                // Store the hash.
                hashes[p] = md5File.sync(p);
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
