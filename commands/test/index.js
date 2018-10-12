/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('test')
        .description('Trigger project `test` script.')
        .readme(`${__dirname}/README.md`)
        .action(async () => {
            const Project = require('../../lib/Project');

            const cwd = process.cwd();
            const project = new Project(cwd);

            return await project.packageManager.test();
        });
};
