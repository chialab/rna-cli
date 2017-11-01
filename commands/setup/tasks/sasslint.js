const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure SASS Lint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    if (options.linting !== false) {
        const cwd = paths.cwd;
        let sasslintConfig = path.join(cwd, '.sass-lint.yml');
        let isNew = !fs.existsSync(sasslintConfig);
        let content = fs.readFileSync(
            path.join(paths.cli, './configs/lint/sass-lint.yml'),
            'utf8'
        );

        // "Append" configuration to `.sass-lint.yml`.
        configurator(sasslintConfig, content, '# RNA');

        if (isNew) {
            app.log(`${colors.green('.sass-lint.yml created.')} ${colors.grey(`(${sasslintConfig})`)}`);
        } else {
            app.log(`${colors.green('.sass-lint.yml updated.')} ${colors.grey(`(${sasslintConfig})`)}`);
        }
    }
    return global.Promise.resolve();
}
