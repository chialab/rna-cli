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
        .readme(`${__dirname}/README.md`)
        .option('<dir>', 'The project root to create.')
        .option('[--git]', 'Git setup.')
        .option('[--npm]', 'Package.json setup.')
        .option('[--lint] [editorconfig|eslint|stylelint]', 'Lint config files.')
        .option('[--license]', 'License files.')
        .option('[--readme]', 'README generation.')
        .action(async (app, options) => {
            const { promises: { mkdir } } = require('fs');
            const path = require('path');
            const { Directory, Project } = require('../../lib/File');

            // Detect directory to use as project root, and ensure it is present.
            let cwd;
            if (options.arguments.length) {
                cwd = path.resolve(process.cwd(), options.arguments[0]);
            } else {
                cwd = process.cwd();
            }

            await mkdir(cwd, { recursive: true });

            const project = new Project(cwd);
            const parentProject = project.parent;
            const templates = new Directory(__dirname).directory('templates');

            // active all flags if none is selected
            const flags = ['git', 'npm', 'lint', 'license', 'readme'];
            if (!flags.some((key) => !!options[key])) {
                flags.forEach((key) => {
                    options[key] = true;
                });
            }

            options.npm && await require('./tasks/npm.js')(app, options, project, templates);
            !parentProject && options.git && await require('./tasks/git.js')(app, options, project, templates);
            await require('./tasks/directories.js')(app, options, project, templates);
            !parentProject && (options.lint === true || options.lint === 'editorconfig') && await require('./tasks/config.js')(app, options, project, templates);
            !parentProject && (options.lint === true || options.lint === 'eslint') && await require('./tasks/eslint.js')(app, options, project, templates);
            !parentProject && (options.lint === true || options.lint === 'styelint') && await require('./tasks/stylelint.js')(app, options, project, templates);
            options.license && await require('./tasks/license.js')(app, options, project, templates);
            options.readme && await require('./tasks/readme.js')(app, options, project, templates);
        });
};
