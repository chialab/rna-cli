const fs = require('fs');
const path = require('path');
const glob = require('glob');
const colors = require('colors/safe');
const Linter = require('eslint').CLIEngine;
const SassLinter = require('sass-lint');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');

/**
 * Get path of ESLint config file.
 *
 * @returns {string}
 */
function getConfig() {
    let localConf = path.join(paths.cwd, '.eslintrc.yml');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
    return path.join(paths.cli, 'configs/lint/eslintrc.yml');
}

/**
 * Run ESLint.
 *
 * @param {CLI} app CLI.
 * @param {Array<string>} sourceFiles List of files to be linted.
 * @param {Object} options Options.
 */
function eslintTask(app, sourceFiles, options) {
    if (options.js !== false && sourceFiles.length) {
        let configFile = getConfig();
        let jsFiles = [];
        sourceFiles
            .filter((src) => fs.existsSync(src))
            .filter((src) => !fs.statSync(src).isFile() || src.match(/\.jsx?$/i))
            .forEach((src) => {
                if (fs.statSync(src).isFile()) {
                    // Physical file.
                    jsFiles.push(src);
                } else {
                    // Workspace.
                    jsFiles.push(...glob.sync(
                        path.join(src, 'src/**/*.{js,jsx}')
                    ));
                }
            });
        if (jsFiles.length) {
            let task = app.log('running ESLint...', true);
            const linter = new Linter({
                configFile,
                cwd: paths.cwd,
            });
            const report = linter.executeOnFiles(jsFiles);
            task(); // Stop loader.
            if (report.errorCount || report.warningCount) {
                if (options.warnings !== false || report.errorCount) {
                    const formatter = linter.getFormatter();
                    app.log(formatter(report.results));
                }
                return global.Promise.resolve(
                    (options.warnings !== false || report.errorCount) ? report : undefined
                );
            }
            app.log(colors.bold('everything is fine with ESLint.'));
            return global.Promise.resolve();
        }
    }
    return global.Promise.resolve();
}

/**
 * Run SASS Lint.
 *
 * @param {CLI} app CLI.
 * @param {Array<string>} sourceFiles List of files to be linted.
 * @param {Object} options Options.
 */
function sasslintTask(app, sourceFiles, options) {
    if (options.styles !== false && sourceFiles.length) {
        let task = app.log('running SassLint...', true);
        let sassFiles = [];
        sourceFiles
            .filter((src) => fs.existsSync(src))
            .filter((src) => !fs.statSync(src).isFile() || src.match(/\.(css|sass|scss)$/i))
            .forEach((src) => {
                if (fs.statSync(src).isFile()) {
                    // Physical file.
                    sassFiles.push(src);
                } else {
                    // Workspace.
                    sassFiles.push(...glob.sync(
                        path.join(src, 'src/**/*.{scss,sass,css}')
                    ));
                }
            });
        if (sourceFiles.length) {
            let reports = [];
            sassFiles.forEach((src) => {
                let report = SassLinter.lintFiles(src, {});
                report.forEach((r) => {
                    if (r.errorCount) {
                        reports.push(r);
                    } else if (r.warningCount && options.warnings !== false) {
                        reports.push(r);
                    }
                });
            });
            task(); // Stop loader.
            if (reports.length) {
                SassLinter.outputResults(reports);
                return global.Promise.resolve(reports);
            }
            app.log(colors.bold('everything is fine with SassLint.'));
        }
    }
    return global.Promise.resolve();
}

/**
 * Command action to run linter.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let filter = optionsUtils.handleArguments(options);
    let toLint = filter.files.concat(Object.values(filter.packages).map((pkg) => pkg.path));
    return eslintTask(app, toLint, options)
        .then((eslintRes) => {
            let res = eslintRes ? [eslintRes] : [];
            return sasslintTask(app, toLint, options)
                .then((sassRes) => {
                    if (sassRes) {
                        res.push(sassRes);
                    }
                    return global.Promise.resolve(res);
                });
        });
};
