const fs = require('fs');
const path = require('path');
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
module.exports = function eslint(app, options, profiler) {
    let configFile = getConfig();
    let jsFiles = [];
    options.files
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

    if (!jsFiles.length) {
        return;
    }
    let profile = profiler.task('eslint');
    let task = app.log('running ESLint...', true);
    try {
        const linter = new Linter({
            configFile,
            cwd: paths.cwd,
            cache: true,
        });
        const report = linter.executeOnFiles(jsFiles);
        profile.end();
        task(); // Stop loader.
        if (report.errorCount || (options.warnings !== false && report.warningCount)) {
            const formatter = require('eslint/lib/formatters/stylish');
            app.log(formatter(report.results));
            return report;
        }

        app.log('everything is fine with ESLint.');
    } catch (err) {
        profile.end();
        task();
        throw err;
    }
};
