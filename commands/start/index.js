/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('start')
        .description('Trigger project `start` script.')
        .readme(`${__dirname}/README.md`)
        .deprecate('2.0.0', 'Please use `yarn start`.')
        .action(async () => {
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = await Project.init(cwd);

            return await project.packageManager.start();
        });
};
