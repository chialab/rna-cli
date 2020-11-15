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
        .deprecate('4.0.0', 'Use GitHub templates.')
        .readme(`${__dirname}/README.md`)
        .option('<dir>', 'The project root to create.')
        .option('[--fs]', 'File system setup.')
        .option('[--git]', 'Git setup.')
        .option('[--npm]', 'Package.json setup.')
        .option('[--lint] [editorconfig|eslint|stylelint]', 'Lint config files.')
        .option('[--license]', 'License files.')
        .option('[--readme]', 'README generation.')
        .action(async (app, options) => {
            const { promises: { mkdir } } = require('fs');
            const path = require('path');
            const { Directory, Project } = require('../../lib/File');
            const tasks = require('./tasks');

            // Detect directory to use as project root, and ensure it is present.
            const cwd = options.arguments.length ?
                path.resolve(process.cwd(), options.arguments[0]) :
                process.cwd();

            await mkdir(cwd, { recursive: true });

            const project = await Project.init(cwd);
            const parentProject = await project.getParent();
            const templates = new Directory(__dirname).directory('templates');

            // active all flags if none is selected
            const flags = ['git', 'npm', 'lint', 'license', 'readme'];
            if (!flags.some((key) => !!options[key])) {
                flags.forEach((key) => {
                    options[key] = true;
                });
            }

            options.npm && await tasks.npm(app, options, project, templates);
            options.git && !parentProject && await tasks.git(app, options, project, templates);
            options.fs && await tasks.directories(app, options, project, templates);
            !parentProject && (options.lint === true || options.lint === 'editorconfig') && await tasks.config(app, options, project, templates);
            !parentProject && (options.lint === true || options.lint === 'eslint') && await tasks.eslint(app, options, project, templates);
            !parentProject && (options.lint === true || options.lint === 'stylelint') && await tasks.stylelint(app, options, project, templates);
            options.license && await tasks.license(app, options, project, templates);
            options.readme && await tasks.readme(app, options, project, templates);
        });
};
