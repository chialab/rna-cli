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
        .action(require('path').resolve(__dirname, './action.js'));
};
