const path = require('path');
const commondir = require('commondir');
const paths = require('../../lib/paths.js');
const Entry = require('../../lib/entry.js');
const Watcher = require('../../lib/Watcher');
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
module.exports = async(app, options, profiler) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }
    let entries = Entry.resolve(paths.cwd, options.arguments.length ? options.arguments : ['src/**/*.*', 'packages/*/src/**/*.*']);

    if (options.js !== false) {
        let eslintTask = require('./linters/eslint.js');
        let eslintRes = await eslintTask(app, { warnings: options.warnings, files: filterJSFiles(entries) }, profiler);
        if (eslintRes) {
            throw 'ESLint found some errors.';
        }
    }

    if (options.styles !== false) {
        let stylelintTask = require('./linters/stylelint.js');
        let sassRes = await stylelintTask(app, { warnings: options.warnings, files: filterStyleFiles(entries) }, profiler);
        if (sassRes) {
            throw 'Stylelint found some errors';
        }
    }

    if (options.watch) {
        let DIR = commondir(entries.map((entry) => (entry.file ? entry.file.path : entry.package.path)));
        let WATCHER = new Watcher({
            cwd: DIR,
        });
        WATCHER.add('**/*.{js,jsx,mjs,sass,scss,css}');
        await WATCHER.watch((event, fp) => {
            app.exec('lint', {
                arguments: [fp],
                warnings: options.warnings,
                styles: options.styles,
                js: options.js,
                watch: false,
            });
        });
    }
};
