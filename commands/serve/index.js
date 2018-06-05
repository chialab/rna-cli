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
        .option('[--tunnel]', 'Create a tunnel for the server')
        .option('[--directory]', 'Should list directories.')
        .option('[--https.key]', 'Path to server https key.')
        .option('[--https.cert]', 'Path to server https certificate.')
        .option('[--https]', 'Path to server https key. [⛔️  deprecated, use --https.key]')
        .option('[--cert]', 'Path to server https certificate. [⛔️  deprecated, use --https.cert]')
        .action(require('path').resolve(__dirname, './action.js'));
};
