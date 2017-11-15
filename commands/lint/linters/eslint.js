const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const glob = require('glob');
const Linter = require('eslint').CLIEngine;
const paths = require('../../../lib/paths.js');

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
 * Lint JS files with ESlint.
 * @param {CLI} app The current CLI instance.
 * @param {object} options A set of options for the linter.
 * @param {string|Array<string>} files Glob string or array of files to lint.
 *
 * @namespace options
 * @property {Boolean} warnings Should include warnings in the response.
 */
module.exports = function eslint(app, options, files) {
    let configFile = getConfig();
    let jsFiles = [];
    files
        .filter((src) => fs.existsSync(src))
        .filter((src) => !fs.statSync(src).isFile() || src.match(/\.m?jsx?$/i))
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
        app.profiler.task('eslint');
        let task = app.log('running ESLint...', true);
        try {
            const linter = new Linter({
                configFile,
                cwd: paths.cwd,
            });
            const report = linter.executeOnFiles(jsFiles);
            app.profiler.endTask('eslint');
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
        } catch (err) {
            task();
            app.log(colors.red('failed to execute ESLint.'));
            return global.Promise.reject(err);
        }
    }
    return global.Promise.resolve();
};
