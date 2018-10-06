const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const PackageManager = require('../../../lib/package-manager.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure stylelint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function stylelintTask(app, cwd, options) {
    const manager = new PackageManager();

    let stylelintConfig = path.join(cwd, '.stylelintrc.yml');
    let isNew = !fs.existsSync(stylelintConfig);
    let content = fs.readFileSync(
        path.join(__dirname, 'templates/stylelintrc.yml'),
        'utf8'
    );

    // "Append" configuration to `.stylelintrc`.
    configurator(stylelintConfig, content, '# RNA');

    if (isNew || options.force) {
        await manager.dev('stylelint', 'stylelint-order');
    }
    app.log(`${colors.green(`.stylelintrc ${isNew ? 'created' : 'updated'}.`)} ${colors.grey(`(${stylelintConfig.replace(cwd, '')})`)}`);
};
