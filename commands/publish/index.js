/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('publish')
        .description('Publish to NPM.')
        .option('[--exact]', 'Update packages dependencies using exact version')
        .option('[--beta]', 'Deploy a beta version of the packages.')
        .option('[--no-git]', 'Do not commit version changes to Git.')
        .option('[--no-npm]', 'Do not commit version changes to NPM.')
        .help('Use `lerna` to handle to publish monorepos.\n')
        .action(require('path').resolve(__dirname, './action.js'));
};
