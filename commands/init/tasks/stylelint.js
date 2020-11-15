const PackageManager = require('../../../lib/PackageManager');

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
    let stylelintConfig = project.file('.stylelintrc.yml');
    let stylelintTemplate = templates.file('stylelintrc.yml');

    // "Append" configuration to `.stylelintrc`.
    if (await stylelintConfig.isNew()) {
        await stylelintConfig.write(await stylelintTemplate.read());
        app.logger.success('.stylelintrc created', project.relative(stylelintConfig));
    }

    await manager.dev(
        'stylelint',
        '@chialab/stylelint-config'
    );
};
