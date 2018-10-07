const Project = require('../../lib/Project');
const { isJSFile, isStyleFile } = require('../../lib/extensions');
const Watcher = require('../../lib/Watcher');

/**
 * Lint JS files with ESlint.
 * @param {CLI} app The current CLI instance.
 * @param {Array<string>} files The list of files to lint.
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
 * @property {boolean} watch Should watch files.
 */
module.exports = async function lint(app, options) {
    const cwd = process.cwd();
    const project = new Project(cwd);

    let entries;
    if (options.arguments.length) {
        entries = project.resolve(options.arguments);
    } else {
        const workspaces = project.workspaces;
        if (workspaces) {
            workspaces.forEach((ws) => {
                let styleDirectory = ws.directories.src;
                if (styleDirectory) {
                    entries.push(...styleDirectory.resolve('**/*'));
                }
            });
        } else {
            let styleDirectory = project.directories.src;
            if (styleDirectory) {
                entries.push(...styleDirectory.resolve('**/*'));
            }
        }
    }

    const jsFiles = entries
        .filter((entry) => isJSFile(entry.path))
        .map((entry) => entry.path);

    const styleFiles = entries
        .filter((entry) => isStyleFile(entry.path))
        .map((entry) => entry.path);

    if (jsFiles.length) {
        if (await eslint(app, jsFiles)) {
            throw 'ESLint found some errors.';
        }
    }

    if (styleFiles.length) {
        if (await stylelint(app, styleFiles)) {
            throw 'Stylelint found some errors';
        }
    }

    if (options.watch) {
        const watcher = new Watcher(cwd);

        watcher.watch(async () => {
            await lint(app);
        });
    }
};
