const path = require('path');
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
            filtered.push(...Entry.resolve(process.cwd(), path.join(entry.package.path, 'src/**/*.{js,jsx,mjs}')));
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
            Entry.resolve(process.cwd(), path.join(entry.package.path, 'src/**/*.{sass,scss}')).forEach((subEntry) => {
                filtered.push(subEntry.file.path);
            });
        }
    });
    return filtered;
}

/**
 * Lint JS files with ESlint.
 * @param {CLI} app The current CLI instance.
 * @param {Array<string>} files The list of files to lint.
 * @param {string|Array<string>} files Glob string or array of files to lint.
 *
 * @namespace options
 * @property {Boolean} warnings Should include warnings in the response.
 */
async function eslint(app, files) {
    const ESLint = require('../../lib/Linters/ESLint.js');

    let profile = app.profiler.task('eslint');
    let task = app.log('running ESLint...', true);
    try {
        const linter = new ESLint();
        const report = await linter.lint(files);
        if (report.errorCount || report.warningCount) {
            app.log(linter.report());
        }
        profile.end();
        task(); // Stop loader.
        if (report.errorCount) {
            return report;
        }
    } catch (err) {
        profile.end();
        task();
        throw err;
    }
}

/**
 * Run Stylelint.
 *
 * @param {CLI} app The current CLI instance.
 * @param {Array<string>} files The list of files to lint.
 *
 * @namespace options
 * @property {Boolean} warnings Should include warnings in the response.
 */
async function stylelint(app, files) {
    const Stylelint = require('../../lib/Linters/Stylelint.js');

    let profile = app.profiler.task('stylelint');
    let task = app.log('running stylelint...', true);
    try {
        let linter = new Stylelint();
        let report = await linter.lint(files);
        if (report.errorCount || report.warningCount) {
            app.log(linter.report());
        }
        profile.end();
        task(); // Stop loader.
        if (report.errorCount) {
            return report;
        }
    } catch(err) {
        profile.end();
        task();
        throw err;
    }
}

/**
 * Command action to run linter.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 *
 * @namespace options
 * @property {Boolean} warnings Should include warnings in the response.
 * @property {Boolean} js Should run linter for JavaScript files.
 * @property {Boolean} styles Should run linter for Sass files.
 * @property {Boolean} watch Should watch files.
 */
module.exports = async function lint(app, options) {
    const cwd = process.cwd();

    let entries = Entry.resolve(cwd, options.arguments.length ? options.arguments : ['src/**/*', 'packages/*/src/**/*']);
    let jsFiles = filterJSFiles(entries);
    let cssFiles = filterStyleFiles(entries);

    if (jsFiles.length) {
        let eslintRes = await eslint(app, jsFiles);
        if (eslintRes) {
            throw 'ESLint found some errors.';
        }
    }

    if (cssFiles.length) {
        let sassRes = await stylelint(app, cssFiles);
        if (sassRes) {
            throw 'Stylelint found some errors';
        }
    }

    if (options.watch) {
        let extensionsToWatch = ['.js', '.jsx', '.mjs', '.sass', '.scss', '.css'];
        let watcher = new Watcher(cwd);

        watcher.watch(async (event, fp) => {
            if (extensionsToWatch.includes(path.extname(fp))) {
                await app.exec('lint', {
                    arguments: [fp],
                    warnings: options.warnings,
                    styles: options.styles,
                    js: options.js,
                    watch: false,
                });
            }
        });
    }
};
