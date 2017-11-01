const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const chokidar = require('chokidar');
const optionsUtils = require('../../lib/options.js');
const cwd = require('../../lib/paths.js').cwd;
const wait = require('../../lib/watch-queue.js');

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
 * Map of jobs currently in progress.
 *
 * @var {{[x: string]: Promise}}
 */
let current = {};

/**
 * Map of scheduled jobs.
 *
 * @var {{[x: string]: Promise}}
 */
let scheduled = {};

/**
 * Queue.
 *
 * @var {Promise}
 */
let q = global.Promise.resolve();

/**
 * Add a job to queue.
 *
 * @param {CLI} app CLI.
 * @param {string} cmd Command name.
 * @param {Object} options Options.
 * @returns {Promise}
 */
function queue(app, cmd, options) {
    let f = options.arguments[0];
    if (scheduled[f]) {
        // Already scheduled: avoid duplicates.
        return scheduled[f];
    }
    // Add something to do in queue.
    q = q.then(() =>
        app.exec(cmd, options)
            .catch(() => global.Promise.resolve()) // Ignore errors.
    );
    if (current[f]) {
        // Already in progress. Add to scheduled.
        scheduled[f] = q;
    } else {
        // Nothing in progress: start immediately.
        current[f] = q;
    }
    q.then(() => {
        // Shift from "scheduled" to "in progress".
        current[f] = scheduled[f];
        delete scheduled[f];
    });
    return q;
}

/**
 * Return list of bundles that depend on path, including the path itself.
 *
 * @param {{[x: string]: {modules: Array<Object>}}} bundles Bundles.
 * @param {string} file Path.
 * @returns {Array<string>}
 */
function findInBundles(bundles, file) {
    let res = [];
    Object.keys(bundles).forEach((bundleName) => {
        let bundle = bundles[bundleName];
        if (bundleName === file) {
            // Path depends from itself.
            res.push(bundleName); // Here it is not checked for duplicates. ~~fquffio
        }
        bundle.modules.forEach((mod) => {
            let deps = mod.dependencies || [];
            if (deps.indexOf(file) !== -1 && res.indexOf(bundleName) === -1) {
                // Path in dependencies and not added to results yet.
                res.push(bundleName);
            }
        });
    });
    return res;
}

/**
 * Command action to watch project files.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = (app, options) => {
    if (!cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }

    // Load list of files to be watched.
    let filter = optionsUtils.handleArguments(options);
    let watch = filter.files
        .concat(Object.values(filter.packages).map((pkg) => pkg.path))
        .filter((p) => fs.existsSync(p))
        .map((p) => {
            if (fs.statSync(p).isFile()) {
                return p;
            }
            return path.join(p, '**/*');
        });
    app.log(colors.bold('watching files...'));

    // Load list of ignored files.
    let ignored = options.exclude || [];
    if (!Array.isArray(ignored)) {
        ignored = [ignored];
    }
    ignored = ignored.map((p) => path.resolve(cwd, p));
    ignored.push(/(^\.|\/\.)/);

    // Start watcher.
    chokidar.watch(watch, {
        ignored,
        ignoreInitial: true,
    }).on('all', (event, p) => {
        wait(p, 200).then(() => {
            let res = global.Promise.resolve();
            if (event === 'change') {
                // File updated.
                app.log(colors.grey(`${formatPath(p)} changed.`));
                if (options.lint !== false) {
                    // Add file lint to queue.
                    let opts = Proteins.clone(options);
                    opts.arguments = [p];
                    opts.warnings = false;
                    res = queue(app, 'lint', opts);
                }
            } else if (event === 'add') {
                // New file.
                app.log(colors.grey(`${formatPath(p)} created.`));
                if (options.lint !== false) {
                    // Add file lint to queue.
                    let opts = Proteins.clone(options);
                    opts.arguments = [p];
                    opts.warnings = false;
                    res = queue(app, 'lint', opts);
                }
            } else if (event === 'unlink') {
                // File deleted.
                app.log(colors.grey(`${formatPath(p)} removed.`));
            }
            res.then((lintReports = []) => {
                if (lintReports.length === 0 && options.build !== false) {
                    // Find list of bundles that require a rebuild.
                    let regenerate = findInBundles(app.generated, p);
                    if (regenerate.length) {
                        return global.Promise.all(
                            regenerate.map((f) => {
                                // Add rebuild to queue.
                                let opts = Proteins.clone(options);
                                opts.arguments = [f];
                                return queue(app, 'build', opts);
                            })
                        );
                    }
                }
                return global.Promise.resolve();
            }).catch((err) => {
                if (err) {
                    // eslint-disable-next-line
                    console.error(err);
                }
                return global.Promise.resolve(); // Ignore errors.
            });
        }).catch(() => { });
    });
};
