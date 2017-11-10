/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('help')
        .description('Show CLI help.')
        .option('[--deprecated]', 'Show deprecated commands.')
        .action((app, options = {}) => require('./action')(app, options));
};
