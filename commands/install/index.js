/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('install')
        .readme(`${__dirname}/README.md`)
        .description('Sync project dependencies after a project update or a git pull.')
        .deprecate('2.0.0', 'Please use `yarn install`.')
        .action(async (app) => {
            const { Project } = require('../../lib/Navigator');
            const cwd = process.cwd();
            const project = new Project(cwd);

            // Run `yarn install`.
            await project.packageManager.install();
            app.logger.success('dependencies successfully updated');
        });
};
