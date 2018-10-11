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
        .option('<module1> <module2> <module3>', 'The modules to remove')
        .action(async (app, options = {}) => {
            const Project = require('../../lib/Project');

            const cwd = process.cwd();
            const project = new Project(cwd);

            // Remove requested packages.
            await project.packageManager.remove(...options.arguments);
            app.logger.success('packages successfully removed');
        });
};
