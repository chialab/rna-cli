const _ = require('lodash');
const { configurator } = require('../utils');

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

    let isNew = await readmeFile.isNew();
    let content = isNew ? '' : await readmeFile.read();

    if (isNew || content.includes(headerPlaceholder)) {
        let template = _.template((await headerTemplate.read()).trim());
        await configurator(readmeFile, template({ project }), headerPlaceholder);
    }

    if (isNew || content.includes(workspacesPlaceholder)) {
        if (project.get('workspaces')) {
            let template = _.template((await workspacesTemplate.read()).trim());
            let workspaces = await project.getWorkspaces();
            await configurator(readmeFile, template({ project, workspaces }), workspacesPlaceholder);
        } else {
            await configurator(readmeFile, '', workspacesPlaceholder);
        }
    }

    if (isNew || content.includes(devPlaceholder)) {
        let template = _.template((await devTemplate.read()).trim());
        await configurator(readmeFile, template({
            project,
        }), devPlaceholder);
    }

    app.logger.success('readme updated', project.relative(readmeFile));
};
