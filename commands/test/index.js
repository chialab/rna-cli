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
        .deprecate('2.0.0', 'Please use `yarn test`.')
        .action(async () => {
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = new Project(cwd);

            return await project.packageManager.test();
        });
};
