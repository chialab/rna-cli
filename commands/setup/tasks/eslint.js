const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');
const manager = require('../../../lib/package-manager.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure ESLint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async(app, options) => {
    if (options.linting === false) {
        return;
    }

    const cwd = paths.cwd;
    let eslintIgnore = path.join(cwd, '.eslintignore');
    let ignoreContent = fs.readFileSync(
        path.join(paths.cli, './configs/lint/eslintignore'),
        'utf8'
    );

    // "Append" configuration to `.eslintignore`.
    configurator(eslintIgnore, ignoreContent, '# RNA');

    let eslintConfig = path.join(cwd, '.eslintrc.yml');
    let isNew = !fs.existsSync(eslintConfig);
    let content = fs.readFileSync(
        path.join(paths.cli, './configs/lint/eslintrc.yml'),
        'utf8'
    );

    // "Append" configuration to `.eslintrc.yml`.
    configurator(eslintConfig, content, '# RNA');

    if (isNew) {
        await manager.dev(paths.cwd, 'eslint', 'eslint-plugin-mocha', 'babel-eslint', 'eslint-plugin-babel');
        app.log(`${colors.green('.eslintrc.yml created.')} ${colors.grey(`(${eslintConfig})`)}`);
        return;
    }
    app.log(`${colors.green('.eslintrc.yml updated.')} ${colors.grey(`(${eslintConfig})`)}`);
};
