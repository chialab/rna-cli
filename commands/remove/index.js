/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('remove')
        .description('Remove project dependencies.')
        .readme(`${__dirname}/README.md`)
        .option('<module1> <module2> <module3>', 'The modules to remove')
        .deprecate('2.0.0', 'Please use `yarn remove`.')
        .action(async (app, options = {}) => {
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = await Project.init(cwd);

            // Remove requested packages.
            await project.packageManager.remove(...options.arguments);
            app.logger.success('packages successfully removed');
        });
};
