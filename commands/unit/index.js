/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('unit')
        .description('Run project unit tests.')
        .help(`It uses \`karma\` (https://karma-runner.github.io/) to unit test the source code.

A default configuration is also provided.
Anyway, the developer can use a custom configuration if the \`karma.conf.js\` file exists in the root of the project.`)
        .option('[--targets]', 'A supported browserslist query.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browser]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use SauceLabs as browsers provider.')
        .option('[--saucelabs.username]', 'SauceLabs username.')
        .option('[--saucelabs.key]', 'SauceLabs access key.')
        .option('[--targets]', 'A browserslist query to test.')
        .option('[--electron]', 'Use electron.')
        .option('[--nativescript <ios|android>]', 'Use nativescript.')
        .option('[--coverage]', 'Enable code coverage.')
        .option('[--ci]', 'Run in continuous integration mode.')
        .option('[--context]', 'Use specified file as Karma custom context file for polyfill script.')
        .action(require('path').resolve(__dirname, './action.js'));
};
