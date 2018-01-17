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
        .option('[--exclude]', 'A glob of files to exclude from the precache.')
        .option('[--watch]', 'Regenerated service worker on source changes.')
        .action(require('path').resolve(__dirname, './action.js'));
};
