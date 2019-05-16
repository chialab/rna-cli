/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('run')
        .description('Trigger project script.')
        .readme(`${__dirname}/README.md`)
        .option('<script>', 'The script to trigger.')
        .deprecate('2.0.0', 'Please use `yarn run`.')
        .action(async () => {
            const { Project } = require('../../lib/Navigator');

            const cwd = process.cwd();
            const project = new Project(cwd);

            return await project.packageManager.run(process.argv[3], process.argv.slice(4));
        });
};
