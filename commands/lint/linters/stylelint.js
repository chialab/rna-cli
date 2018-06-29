const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const glob = require('glob');
const stylelint = require('stylelint');
const paths = require('../../../lib/paths.js');

/**
 * Get path of ESLint config file.
 *
 * @returns {string}
 */
function getConfig() {
    let localConf = path.join(paths.cwd, '.stylelintrc.yml');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
    return path.join(paths.cli, 'configs/lint/stylelintrc.yml');
}

/**
 * Run stylelint.
 *
 * @param {CLI} app The current CLI instance.
 * @param {object} options A set of options for the linter.
 * @param {string|Array<string>} files Glob string or array of files to lint.
 *
 * @namespace options
 * @property {Boolean} warnings Should include warnings in the response.
 */
module.exports = function stylelintTask(app, options, profiler) {
    let configFile = getConfig();
    let styleFiles = [];
    options.files
        .filter((src) => fs.existsSync(src))
        .filter((src) => !fs.statSync(src).isFile() || src.match(/\.(css|sass|scss)$/i))
        .forEach((src) => {
            if (fs.statSync(src).isFile()) {
                // Physical file.
                styleFiles.push(src);
            } else {
                // Workspace.
                styleFiles.push(...glob.sync(
                    path.join(src, 'src/**/*.{scss,sass,css}')
                ));
            }
        });
    if (styleFiles.length) {
        let profile = profiler.task('stylelint');
        let task = app.log('running stylelint...', true);
        return stylelint.lint({
            configFile,
            files: styleFiles,
            syntax: 'scss',
        }).then((reports) => {
            profile.end();
            task(); // Stop loader.
            let errorCount = 0;
            let warningCount = 0;
            // convert stylelint report format to eslint format
            const eslintLikeReport = reports.results.map((report) => {
                let fileErrorCount = 0;
                let fileWarningCount = 0;
                let messages = report.warnings.map((warn) => {
                    if (warn.severity === 'error') {
                        fileErrorCount++;
                    } else {
                        fileWarningCount++;
                    }
                    return {
                        ruleId: warn.rule,
                        severity: warn.severity === 'error' ? 2 : 1,
                        line: warn.line,
                        column: warn.column,
                        message: warn.text,
                    };
                });
                errorCount += fileErrorCount;
                warningCount += fileWarningCount;
                const res = {
                    filePath: report.source,
                    warningCount: fileWarningCount,
                    errorCount: fileErrorCount,
                    messages,
                };

                return res;
            });
            if (errorCount || warningCount) {
                if (options.warnings !== false || errorCount) {
                    const formatter = require('eslint/lib/formatters/stylish');
                    app.log(formatter(eslintLikeReport));
                }
                return global.Promise.resolve(
                    (options.warnings !== false || errorCount) ? reports : undefined
                );
            }
            app.log('everything is fine with stylelint.');
            return global.Promise.resolve(reports);
        }).catch((err) => {
            profile.end();
            task();
            app.log(colors.red('failed to execute stylelint.'));
            return global.Promise.reject(err);
        });
    }
    return global.Promise.resolve();
};
