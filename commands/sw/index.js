/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('sw')
        .description('Generate a service worker.')
        .option('<path>', 'Root of the app to cache.')
        .option('--output', 'The service worker to generate or update.')
        .action((app, options = {}) => require('./action')(app, options));
};
