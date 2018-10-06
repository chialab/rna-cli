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
module.exports = async function stylelintTask(app, options) {
    const cwd = paths.cwd;
    let stylelintConfig = path.join(cwd, '.stylelintrc.yml');
    let isNew = !fs.existsSync(stylelintConfig);
    let content = fs.readFileSync(
        path.join(paths.cli, './configs/lint/stylelintrc.yml'),
        'utf8'
    );

    // "Append" configuration to `.stylelintrc`.
    configurator(stylelintConfig, content, '# RNA');

    if (isNew || options.force) {
        await manager.dev(paths.cwd, 'stylelint', 'stylelint-order');
    }
    app.log(`${colors.green(`.stylelintrc ${isNew ? 'created' : 'updated'}.`)} ${colors.grey(`(${stylelintConfig.replace(cwd, '')})`)}`);
};
