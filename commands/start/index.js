/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('start')
        .description('Trigger project `start` script.')
        .help('A simple alias to `yarn start` command.')
        .action((app, options = {}) => require('./action')(app, options));
};
