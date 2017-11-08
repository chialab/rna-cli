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
        .option('[--saucelabs]', 'Use saucelabs as browsers provider.')
        .option('[--electron]', 'Use electron.')
        .option('[--no-coverage]', 'Disable code coverage.')
        .option('[--no-chrome]', 'Do not start Chrome browser.')
        .option('[--no-firefox]', 'Do not start Firefox browser.')
        .action((app, options = {}) => require('./action')(app, options));
};
