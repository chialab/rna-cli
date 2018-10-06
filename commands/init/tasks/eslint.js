const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const manager = require('../../../lib/package-manager.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure ESLint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function eslintTask(app, cwd, options) {
    const eslintIgnore = path.join(cwd, '.eslintignore');
    const eslintConfig = path.join(cwd, '.eslintrc.yml');

    let ignoreContent = fs.readFileSync(
        path.join(__dirname, 'templates/eslintignore'),
        'utf8'
    );

    // "Append" configuration to `.eslintignore`.
    configurator(eslintIgnore, ignoreContent, '# RNA');

    let isNew = !fs.existsSync(eslintConfig);
    let content = fs.readFileSync(
        path.join(__dirname, 'templates/eslintrc.yml'),
        'utf8'
    );

    // "Append" configuration to `.eslintrc.yml`.
    configurator(eslintConfig, content, '# RNA');

    if (isNew || options.force) {
        await manager.dev(cwd, 'eslint', 'eslint-plugin-mocha', 'babel-eslint', 'eslint-plugin-babel');
    }
    app.log(`${colors.green(`.eslintrc.yml ${isNew ? 'created' : 'updated'}.`)} ${colors.grey(`(${eslintConfig.replace(cwd, '')})`)}`);
};
