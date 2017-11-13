const colors = require('colors/safe');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');

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
    let res = [];
    let filter = optionsUtils.handleArguments(options);
    let lintFiles = filter.files.concat(Object.values(filter.packages).map((pkg) => pkg.path));
    let linterOptions = { warnings: options.warnings };
    let eslintTask = options.js !== false ?
        require('./linters/eslint.js') :
        () => global.Promise.resolve();
    return eslintTask(app, linterOptions, lintFiles)
        .then((eslintRes) => {
            if (eslintRes) {
                res.push(eslintRes);
            }
            let sasslintTask = options.styles !== false ?
                require('./linters/sass-lint.js') :
                () => global.Promise.resolve();
            return sasslintTask(app, linterOptions, lintFiles)
                .then((sassRes) => {
                    if (sassRes) {
                        res.push(sassRes);
                    }
                    return global.Promise.resolve(res);
                });
        });
};
