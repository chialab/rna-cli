/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('e2e')
        .description('Run project e2e tests.')
        .help(`It uses \`nightwatch\` (http://nightwatchjs.org/) and \`Selenium\` (http://www.seleniumhq.org/).

A default configuration is also provided.
Anyway, the developer can use a custom configuration if the \`nightwatch.conf.js\` file exists in the root of the project.`)
        .option('<path>', 'The e2e tests path.')
        .option('[--url]', 'The app url to test.')
        .option('[--targets]', 'A browserslist query to test.')
        .option('[--saucelabs]', 'Run tests in the SauceLabs cloud.')
        .option('[--selenium.host]', 'Selenium hostname. Default `localhost`.')
        .option('[--selenium.port]', 'Selenium port. Default `4444`.')
        .option('[--screenshots]', 'The path where to save screenshots.')
        .action(require('path').resolve(__dirname, './action.js'));
};
