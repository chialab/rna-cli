/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('e2e')
        .description('Run project end-to-end tests.')
        .help(`It uses \`testcafe\` (http://devexpress.github.io/testcafe/) to end-to-end test the source code.

    As default, it launches tests on Chrome browser.`)
        .option('[--ci]', 'Run in continuous integration mode.')
        .option('[--saucelabs]', 'Use saucelabs as browsers provider.')
        .option('[--slow]', 'Run tests half the default speed.')
        .option('[--d]', 'Run tests in debug mode.')
        .action((app, options = {}) => require('./action')(app, options));
};
