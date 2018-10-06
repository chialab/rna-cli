/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('init')
        .description('Setup a new project.')
        .option('<dir>', 'The project root to create.')
        .option('[--git]', 'Git setup.')
        .option('[--npm]', 'Package.json setup.')
        .option('[--lint]', 'Lint config files.')
        .option('[--license]', 'License files.')
        .option('[--readme]', 'README generation.')
        .action(`${__dirname}/action.js`);
};
