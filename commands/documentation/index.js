/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('documentation')
        .description('Generate API references.')
        .option('--output', 'The markdown file to create.')
        .action((app, options = {}) => require('./action')(app, options));
};
