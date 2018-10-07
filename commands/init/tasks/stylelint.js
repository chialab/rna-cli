const colors = require('colors/safe');
const PackageManager = require('../../../lib/PackageManager.js');
const configurator = require('../../../lib/configurator.js');

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
    const stylelintTemplate = templates.file('stylelintrc.yml');

    // "Append" configuration to `.stylelintrc`.
    configurator(stylelintConfig, stylelintTemplate.read(), '# RNA');

    await manager.dev('stylelint', 'stylelint-order');
    app.log(`${colors.green('.stylelintrc updated.')} ${colors.grey(`(${stylelintConfig.localPath})`)}`);
};
