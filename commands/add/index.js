/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('add')
        .description('Add project dependencies.')
        .help('A simple alias to `yarn add` command.')
        .option('<module1> <module2> <module3>', 'The modules to add')
        .option('[--dev]', 'Add to dev dependencies.')
        .action(`${__dirname}/action.js`);
};
