const PackageManager = require('../../../lib/PackageManager.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure ESLint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function eslintTask(app, options, project, templates) {
    const manager = new PackageManager(project.path);
    const eslintConfig = project.file('.eslintrc.yml');
    const eslintIgnore = project.file('.eslintignore');

    const configTemplate = templates.file('eslintrc.yml');
    const ignoreTemplate = templates.file('eslintignore');

    // "Append" configuration to `.eslintrc.yml`.
    configurator(eslintConfig, configTemplate.read(), '# RNA');

    // "Append" configuration to `.eslintignore`.
    configurator(eslintIgnore, ignoreTemplate.read(), '# RNA');

    await manager.dev('eslint', 'eslint-plugin-mocha', 'eslint-plugin-mocha-no-only', 'babel-eslint', 'eslint-plugin-babel');
    app.logger.success('.eslintrc.yml updated', eslintConfig.localPath);
};
