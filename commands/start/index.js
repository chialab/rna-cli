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
        .help('A simple alias to `yarn start` command.')
        .action(async () => {
            const Project = require('../../lib/Project');

            const cwd = process.cwd();
            const project = new Project(cwd);

            return await project.packageManager.start();
        });
};
