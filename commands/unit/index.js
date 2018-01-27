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
        .option('[--ci]', 'Run in continuous integration mode.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browser]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use saucelabs as browsers provider.')
        .option('[--electron]', 'Use electron.')
        .option('[--nativescript]', 'Use nativescript.')
        .option('[--ios]', 'Run test in iOS emulator.')
        .option('[--android]', 'Run test in Android emulator.')
        .option('[--coverage]', 'Enable code coverage.')
        .action(require('path').resolve(__dirname, './action.js'));
};
