/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('serve')
        .description('Setup a server for your project.')
        .option('<file>', 'The server directory.')
        .option('[--port]', 'The server port.')
        .option('[--watch]', 'Should watch server directory.')
        .option('[--directory]', 'Should list directories.')
        .option('[--https]', 'Path to server https key.')
        .action(require('path').resolve(__dirname, './action.js'));
};
