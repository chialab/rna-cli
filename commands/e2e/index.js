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

    As default, it launches tests on Chrome browser.`) //TODO commented not implemented options
        // .option('[--ci]', 'Run in continuous integration mode.')
        // .option('[--saucelabs]', 'Use saucelabs as browsers provider.')
        .option('[--slow <speed>]', 'Slow testcafe at the specified value. If not specified, run tests at half speed (0.5).')
        .option('[--proxy <parameters>]', 'Run testcafe using specified proxy parameters.')
        .option('[--debug]', 'Run tests in debug mode.')
        .option('[--browserslist]', 'List browsers aliases available for testcafe.')
        .option('[--browser <browser>]', 'Run test for specified browser using testcafe browser alias.')
        .action((app, options = {}) => require('./action')(app, options));
};
