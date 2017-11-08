/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('remove')
        .description('Remove project dependencies.')
        .help('A simple alias to `yarn add` command.')
        .option('<module1> <module2> <module3>', 'The modules to remove')
        .action((app, options = {}) => require('./action')(app, options));
};
