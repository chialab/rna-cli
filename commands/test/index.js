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
        .help('A simple alias to `yarn test` command.')
        .action(`${__dirname}/action.js`);
};
