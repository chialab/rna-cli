const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const manager = require('../../../lib/package-manager.js');
const paths = require('../../../lib/paths.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure stylelint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    let stylelintPromise = global.Promise.resolve();
    if (options.linting !== false) {
        const cwd = paths.cwd;
        let stylelintConfig = path.join(cwd, '.stylelintrc.yml');
        let isNew = !fs.existsSync(stylelintConfig);
        let content = fs.readFileSync(
            path.join(paths.cli, './configs/lint/stylelintrc.yml'),
            'utf8'
        );

        // "Append" configuration to `.stylelintrc`.
        configurator(stylelintConfig, content, '# RNA');

        if (isNew) {
            stylelintPromise = manager.dev(paths.cwd, 'stylelint', 'stylelint-order');
            app.log(`${colors.green('.stylelintrc created.')} ${colors.grey(`(${stylelintConfig})`)}`);
        } else {
            app.log(`${colors.green('.stylelintrc updated.')} ${colors.grey(`(${stylelintConfig})`)}`);
        }
    }
    return stylelintPromise;
};
