const fs = require('fs-extra');
const path = require('path');
const Project = require('../../lib/Project');
const { NavigatorDirectory } = require('../../lib/Navigator.js');

/**
 * Command action to setup a new project.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function setup(app, options) {
    // Detect directory to use as project root, and ensure it is present.
    let cwd;
    if (options.arguments.length) {
        cwd = path.resolve(process.cwd(), options.arguments[0]);
    } else {
        cwd = process.cwd();
    }
    fs.ensureDirSync(cwd);

    const project = new Project(cwd);
    const templates = new NavigatorDirectory(__dirname).directory('templates');

    // active all flags if none is selected
    const flags = ['git', 'npm', 'lint', 'license', 'readme'];
    if (!flags.some((key) => options[key] === true)) {
        flags.forEach((key) => {
            options[key] = true;
        });
    }

    options.npm && await require('./tasks/npm.js')(app, options, project, templates);
    !project.hasWorkspace && options.git && await require('./tasks/git.js')(app, options, project, templates);
    await require('./tasks/directories.js')(app, options, project, templates);
    !project.hasWorkspace && options.lint && await require('./tasks/config.js')(app, options, project, templates);
    !project.hasWorkspace && options.lint && await require('./tasks/eslint.js')(app, options, project, templates);
    !project.hasWorkspace && options.lint && await require('./tasks/stylelint.js')(app, options, project, templates);
    options.license && await require('./tasks/license.js')(app, options, project, templates);
    options.readme && await require('./tasks/readme.js')(app, options, project, templates);
};
