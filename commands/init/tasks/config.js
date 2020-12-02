const { configurator } = require('../utils');

/**
 * Ensure EditorConfig configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async (app, options, project, templates) => {
    let editorConfig = project.file('.editorconfig');
    let template = templates.file('editorconfig');

    // "Append" configuration to `.editorconfig`.
    await configurator(editorConfig, await template.read(), '# RNA');

    app.logger.success('.editorconfig updated', project.relative(editorConfig));
};
