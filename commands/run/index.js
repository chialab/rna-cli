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
        .help('A simple alias to `yarn run` command.')
        .action(require('path').resolve(__dirname, './action.js'));
};
