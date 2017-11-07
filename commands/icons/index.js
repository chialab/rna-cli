/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('icons')
        .description('Generate icons for a webapp.')
        .option('<path>', 'The master icon.')
        .option('--output', 'Where to save the generated icons.')
        .option('[--manifest]', 'Original webapp manifest.')
        .option('[--path]', 'Relative path from index/manifest.')
        .option('[--no-ios]', 'Do not generate ios icons.')
        .option('[--no-android]', 'Do not generate android icons.')
        .option('[--no-favicons]', 'Do not generate favicons.')
        .action((app, options = {}) => require('./action')(app, options));
};
