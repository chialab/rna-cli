/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('upgrade')
        .description('Upgrade the CLI.')
        .help('Try to install the latest version of the CLI.')
        .action(require('path').resolve(__dirname, './action.js'));
};
