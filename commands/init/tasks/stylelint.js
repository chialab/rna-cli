const PackageManager = require('../../../lib/PackageManager');
const { configurator } = require('../utils');

/**
 * Ensure stylelint configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function stylelintTask(app, options, project, templates) {
    const manager = new PackageManager(project.path);
    const stylelintConfig = project.file('.stylelintrc.yml');
    const stylelintIgnore = project.file('.stylelintignore');

    const stylelintTemplate = templates.file('stylelintrc.yml');
    const ignoreTemplate = templates.file('stylelintignore');

    // "Append" configuration to `.stylelintrc`.
    configurator(stylelintConfig, stylelintTemplate.read(), '# RNA');

    // "Append" configuration to `.eslintignore`.
    configurator(stylelintIgnore, ignoreTemplate.read(), '# RNA');

    await manager.dev(
        'stylelint',
        'stylelint-order'
    );
    app.logger.success('.stylelintrc updated', stylelintConfig.localPath);
};
