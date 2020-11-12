const { configurator } = require('../utils');
const PackageManager = require('../../../lib/PackageManager');

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
    let eslintConfig = project.file('.eslintrc.yml');
    let eslintIgnore = project.file('.eslintignore');

    let configTemplate = templates.file('eslintrc.yml');
    let ignoreTemplate = templates.file('eslintignore');

    // "Append" configuration to `.eslintrc.yml`.
    await configurator(eslintConfig, await configTemplate.read(), '# RNA');

    // "Append" configuration to `.eslintignore`.
    await configurator(eslintIgnore, await ignoreTemplate.read(), '# RNA');

    await manager.dev(
        'eslint',
        'eslint-plugin-mocha',
        'eslint-plugin-mocha-no-only',
        'babel-eslint',
        'eslint-plugin-babel',
        'eslint-plugin-jsx-a11y'
    );

    app.logger.success('.eslintrc.yml updated', project.relative(eslintConfig));
};
