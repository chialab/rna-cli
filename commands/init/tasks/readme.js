const _ = require('lodash');
const { configurator } = require('../utils/index.js');

/**
 * Ensure README file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function readmeTask(app, options, project, templates) {
    const readmeFile = project.file('README.md');
    const headerTemplate = templates.file('README.header.md');
    const workspacesTemplate = templates.file('README.workspaces.md');
    const devTemplate = templates.file('README.dev.md');
    const headerPlaceholder = '<!-- RNA-HEADER -->';
    const workspacesPlaceholder = '<!-- RNA-WORKSPACES -->';
    const devPlaceholder = '<!-- RNA-DEV -->';


    const isNew = !readmeFile.exists();
    const content = isNew ? '' : readmeFile.read();

    if (isNew || content.includes(headerPlaceholder)) {
        const template = _.template(headerTemplate.read().trim());
        configurator(readmeFile, template({
            project,
        }), headerPlaceholder);
    }

    if (isNew || content.includes(workspacesPlaceholder)) {
        if (project.get('workspaces')) {
            const template = _.template(workspacesTemplate.read().trim());
            configurator(readmeFile, template({
                project,
            }), workspacesPlaceholder);
        } else {
            configurator(readmeFile, '', workspacesPlaceholder);
        }
    }

    if (isNew || content.includes(devPlaceholder)) {
        const template = _.template(devTemplate.read().trim());
        configurator(readmeFile, template({
            project,
        }), devPlaceholder);
    }

    app.logger.success('readme updated', readmeFile.localPath);
};
