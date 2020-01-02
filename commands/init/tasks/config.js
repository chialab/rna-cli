const { configurator } = require('../utils/index.js');

/**
 * Ensure EditorConfig configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = (app, options, project, templates) => {
    const editorConfig = project.file('.editorconfig');
    const template = templates.file('editorconfig');

    // "Append" configuration to `.editorconfig`.
    configurator(editorConfig, template.read(), '# RNA');

    app.logger.success('.editorconfig updated', editorConfig.localPath);
};
