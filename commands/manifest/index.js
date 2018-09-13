/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('manifest')
        .description('Generate webapp Manifest.')
        .option('<path>', 'The webapp path.')
        .option('--output', 'Where to save the generated manifest.')
        .option('[--manifest]', 'Original webapp manifest.')
        .option('[--icon]', 'The path of the main icon to generate.')
        .option('[--index]', 'Path to the index.html to update.')
        .option('[--scope]', 'Force manifest scope.')
        .option('[--ci]', 'Enable CI mode.')
        .action(`${__dirname}/action.js`);
};
