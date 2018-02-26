const path = require('path');
const colors = require('colors/safe');
const commondir = require('commondir');
const paths = require('../../lib/paths.js');
const Entry = require('../../lib/entry.js');
const Watcher = require('../../lib/watcher');
const ext = require('../../lib/extensions.js');

function filterJSFiles(entries) {
    let filtered = [];
    entries.forEach((entry) => {
        if (entry.file) {
            if (ext.isJSFile(entry.file.path)) {
                filtered.push(entry.file.path);
            }
        } else if (entry.package) {
            filtered.push(...Entry.resolve(paths.cwd, path.join(entry.package.path, 'src/**/*.{js,jsx,mjs}')));
        }
    });
    return filtered;
}

function filterStyleFiles(entries) {
    let filtered = [];
    entries.forEach((entry) => {
        if (entry.file) {
            if (ext.isStyleFile(entry.file.path)) {
                filtered.push(entry.file.path);
            }
        } else if (entry.package) {
            Entry.resolve(paths.cwd, path.join(entry.package.path, 'src/**/*.{sass,scss}')).forEach((subEntry) => {
                filtered.push(subEntry.file.path);
            });
        }
    });
    return filtered;
}

/**
 * Command action to run linter.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @param {Profiler} profiler The command profiler instance.
 * @returns {Promise}
 *
 * @namespace options
 * @property {Boolean} warnings Should include warnings in the response.
 * @property {Boolean} js Should run linter for JavaScript files.
 * @property {Boolean} styles Should run linter for Sass files.
 * @property {Boolean} watch Should watch files.
 */
module.exports = (app, options, profiler) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let res = [];
    let entries = Entry.resolve(paths.cwd, options.arguments.length ? options.arguments : ['src/**/*.*', 'packages/*/src/**/*.*']);
    const eslintTask = options.js !== false ? require('./linters/eslint.js') : () => global.Promise.resolve();
    let response = eslintTask(app, { warnings: options.warnings, files: filterJSFiles(entries) }, profiler)
        .then((eslintRes) => {
            if (eslintRes) {
                res.push(eslintRes);
            }
            const sasslintTask = options.styles !== false ? require('./linters/sass-lint.js') : () => global.Promise.resolve();
            return sasslintTask(app, { warnings: options.warnings, files: filterStyleFiles(entries) }, profiler)
                .then((sassRes) => {
                    if (sassRes) {
                        res.push(sassRes);
                    }
                    return global.Promise.resolve(res);
                });
        });

    return response
        .then((res) => {
            if (options.watch) {
                const DIR = commondir(entries.map((entry) => (entry.file ? entry.file.path : entry.package.path)));
                const WATCHER = new Watcher({
                    cwd: DIR,
                });
                WATCHER.add('**/*.{js,jsx,sass,scss,css}');
                return WATCHER.watch((event, fp) => {
                    app.exec('lint', {
                        arguments: [fp],
                        warnings: options.warnings,
                        styles: options.styles,
                        js: options.js,
                        watch: false,
                    });
                });
            }
            return global.Promise.resolve(res);
        });
};
