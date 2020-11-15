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
    let configTemplate = templates.file('eslintrc.yml');

    // "Append" configuration to `.eslintrc.yml`.
    if (await eslintConfig.isNew()) {
        await eslintConfig.write(await configTemplate.read());
        app.logger.success('.eslintrc.yml created', project.relative(eslintConfig));
    }

    await manager.dev(
        'eslint',
        '@chialab/eslint-config'
    );
};
