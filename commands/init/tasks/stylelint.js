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
    let stylelintConfig = project.file('.stylelintrc.yml');
    let stylelintIgnore = project.file('.stylelintignore');

    let stylelintTemplate = templates.file('stylelintrc.yml');
    let ignoreTemplate = templates.file('stylelintignore');

    // "Append" configuration to `.stylelintrc`.
    await configurator(stylelintConfig, await stylelintTemplate.read(), '# RNA');

    // "Append" configuration to `.stylelintignore`.
    await configurator(stylelintIgnore, await ignoreTemplate.read(), '# RNA');

    await manager.dev(
        'stylelint',
        'stylelint-order'
    );

    app.logger.success('.stylelintrc updated', project.relative(stylelintConfig));
};
