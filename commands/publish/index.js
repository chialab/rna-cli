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
        .readme(`${__dirname}/README.md`)
        .option('<version>', 'The version to bump')
        .option('[--canary]', 'Deploy a canary version of the packages.')
        .option('[--no-git]', 'Do not commit version changes to Git.')
        .option('[--no-npm]', 'Do not commit version changes to NPM.')
        .action(async (app, options) => {
            const exec = require('../../lib/exec.js');
            const BIN = require.resolve('lerna/cli.js');

            if (!options.arguments.length) {
                throw 'missing version';
            }

            let command = 'publish';
            let args = [options.arguments[0]];
            if (options.git === false) {
                args.push('--no-git-tag-version', '--no-push');
            } else {
                args.push('--push');
            }
            if (options.canary || options.beta) {
                args.push('--canary');
            }
            if (options.npm === false) {
                command = 'version';
            }
            if (process.env.CI) {
                args.push('--yes');
            }

            return await exec(BIN, [command, ...args]);
        });
};
