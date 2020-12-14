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
    let directories = project.directories;
    let srcDir = directories.src;
    let publicDir = directories.public;
    let styleFile = project.get('style') && project.file(project.get('style'));
    let moduleFile = project.get('exports') && project.file(project.get('exports')) ||
        project.get('module') && project.file(project.get('module'));
    let mainFile = project.get('main') && project.file(project.get('main'));

    for (let dir in directories) {
        await directories[dir].ensure();
    }

    // Ensure path specified in `package.json` "main" key is present.
    if (publicDir) {
        // Using a simple HTML file as main entrypoint.
        let indexFile = srcDir.file('index.html');
        if (await indexFile.isNew()) {
            let template = _.template(await templates.file('index.html').read());
            await indexFile.write(template({
                project,
            }));
            if (await srcDir.file('index.js').isNew()) {
                await srcDir.file('index.js').write('');
            }
            if (await srcDir.file('index.css').isNew()) {
                await srcDir.file('index.css').write('');
            }
        }
    }

    if (moduleFile) {
        // Ensure path specified in `package.json` "exports" exists.
        if (await moduleFile.isNew()) {
            await moduleFile.write('');
        }
    }

    if (mainFile) {
        // Ensure path specified in `package.json` "main" exists.
        if (await mainFile.isNew()) {
            await mainFile.write('');
        }
    }

    if (styleFile) {
        // Ensure path specified in `package.json` "style" exists.
        if (await styleFile.isNew()) {
            await styleFile.write('');
        }
    }

    if (project.get('workspaces')) {
        // Ensure paths listed as workspaces are present.
        await Promise.all(
            project.get('workspaces').map((ws) =>
                project.directory(path.dirname(ws)).ensure()
            )
        );
    }
};
