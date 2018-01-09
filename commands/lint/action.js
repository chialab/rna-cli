const colors = require('colors/safe');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');
const watcher = require('../../lib/watcher.js');

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
    let filter = optionsUtils.handleArguments(options);
    let lintFiles = filter.files.concat(Object.values(filter.packages).map((pkg) => pkg.path));
    let linterOptions = { warnings: options.warnings, files: lintFiles };
    const eslintTask = options.js !== false ? require('./linters/eslint.js') : () => global.Promise.resolve();
    let response = eslintTask(app, linterOptions, profiler)
        .then((eslintRes) => {
            if (eslintRes) {
                res.push(eslintRes);
            }
            const sasslintTask = options.styles !== false ? require('./linters/sass-lint.js') : () => global.Promise.resolve();
            return sasslintTask(app, linterOptions, profiler)
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
                watcher(app, lintFiles, (event, fp) => {
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
