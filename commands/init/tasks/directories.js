const path = require('path');
const _ = require('lodash');

/**
 * Ensure basic tree structure is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function directoriesTask(app, otpions, project, templates) {
    const directories = project.directories;
    const publicDir = directories.public;
    const styleFile = project.get('style') && project.file(project.get('style'));
    const moduleFile = project.get('module') && project.file(project.get('module'));
    const mainFile = project.get('main') && project.file(project.get('main'));

    for (let dir in directories) {
        directories[dir].ensureExists();
    }

    // Ensure path specified in `package.json` "main" key is present.
    if (publicDir) {
        // Using a simple HTML file as main entrypoint.
        let indexFile = publicDir.file('index.html');
        if (!indexFile.exists()) {
            let template = _.template(templates.file('index.html').read());
            indexFile.write(template({
                project,
            }));
        }
    }

    if (moduleFile) {
        // Ensure path specified in `package.json` "module" exists.
        if (!moduleFile.exists()) {
            moduleFile.write('');
        }
    }

    if (mainFile) {
        // Ensure path specified in `package.json` "main" exists.
        if (!mainFile.exists()) {
            mainFile.write('');
        }
    }

    if (styleFile) {
        // Ensure path specified in `package.json` "style" exists.
        if (!styleFile.exists()) {
            styleFile.write('');
        }
    }

    if (project.get('workspaces')) {
        // Ensure paths listed as workspaces are present.
        project.get('workspaces').forEach((ws) => {
            project.directory(path.dirname(ws)).ensureExists();
        });
    }
};
