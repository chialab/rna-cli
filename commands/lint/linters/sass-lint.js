const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const glob = require('glob');
const SassLinter = require('sass-lint');

/**
 * Run SASS Lint.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @param {string|Array<string>} sourceFiles List of files to be linted.
 */
module.exports = function sasslintTask(app, options, files) {
    let sassFiles = [];
    files
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
    if (sassFiles.length) {
        app.profiler.task('sass-lint');
        let task = app.log('running SassLint...', true);
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
        app.profiler.endTask('sass-lint');
        task(); // Stop loader.
        if (reports.length) {
            SassLinter.outputResults(reports);
            return global.Promise.resolve(reports);
        }
        app.log(colors.bold('everything is fine with SassLint.'));
    }
    return global.Promise.resolve();
}
