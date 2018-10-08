/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('init')
        .description('Setup a new project.')
        .option('<dir>', 'The project root to create.')
        .option('[--git]', 'Git setup.')
        .option('[--npm]', 'Package.json setup.')
        .option('[--lint]', 'Lint config files.')
        .option('[--license]', 'License files.')
        .option('[--readme]', 'README generation.')
        .action(async (app, options) => {
            const fs = require('fs-extra');
            const path = require('path');
            const Project = require('../../lib/Project');
            const { NavigatorDirectory } = require('../../lib/Navigator.js');

            // Detect directory to use as project root, and ensure it is present.
            let cwd;
            if (options.arguments.length) {
                cwd = path.resolve(process.cwd(), options.arguments[0]);
            } else {
                cwd = process.cwd();
            }
            fs.ensureDirSync(cwd);

            const project = new Project(cwd);
            const parentProject = project.parent;
            const templates = new NavigatorDirectory(__dirname).directory('templates');

            // active all flags if none is selected
            const flags = ['git', 'npm', 'lint', 'license', 'readme'];
            if (!flags.some((key) => options[key] === true)) {
                flags.forEach((key) => {
                    options[key] = true;
                });
            }

            options.npm && await require('./tasks/npm.js')(app, options, project, templates);
            !parentProject && options.git && await require('./tasks/git.js')(app, options, project, templates);
            await require('./tasks/directories.js')(app, options, project, templates);
            !parentProject && options.lint && await require('./tasks/config.js')(app, options, project, templates);
            !parentProject && options.lint && await require('./tasks/eslint.js')(app, options, project, templates);
            !parentProject && options.lint && await require('./tasks/stylelint.js')(app, options, project, templates);
            options.license && await require('./tasks/license.js')(app, options, project, templates);
            options.readme && await require('./tasks/readme.js')(app, options, project, templates);
        });
};
