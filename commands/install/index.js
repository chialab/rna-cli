/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('install')
        .description('Sync project dependencies after a project update or a git pull.')
        .help('A simple alias to `yarn install` command.')
        .action(async (app) => {
            const colors = require('colors/safe');
            const Project = require('../../lib/Project');
            const cwd = process.cwd();
            const project = new Project(cwd);

            // Run `yarn install`.
            await project.packageManager.install();
            app.log(colors.green('dependencies successfully updated.'));
        });
};
