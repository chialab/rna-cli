/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('publish')
        .description('Publish to Git and NPM.')
        .readme(`${__dirname}/README.md`)
        .option('[version]', 'The version to bump')
        .option('[--patch]', 'Deploy a patch version of the package(s).')
        .option('[--minor]', 'Deploy a minor version of the package(s).')
        .option('[--major]', 'Deploy a major version of the package(s).')
        .option('[--alpha]', 'Deploy an alpha version of the package(s).')
        .option('[--beta]', 'Deploy a beta version of the package(s).')
        .option('[--rc]', 'Deploy a rc version of the package(s).')
        .option('[--no-git]', 'Do not commit version changes to Git.')
        .option('[--no-npm]', 'Do not commit version changes to NPM.')
        .action(async (app, options) => {
            const { Project } = require('../../lib/File');
            const cwd = process.cwd();
            const project = new Project(cwd);

            let version;
            if (options.arguments.length) {
                version = options.arguments[0];
            } else if (options.canary) {
                version = 'canary';
            } else if (options.alpha) {
                version = 'alpha';
            } else if (options.beta) {
                version = 'beta';
            } else if (options.rc) {
                version = 'rc';
            } else if (options.patch) {
                version = 'patch';
            } else if (options.minor) {
                version = 'minor';
            } else if (options.major) {
                version = 'major';
            }

            return await project.publish(version, options.git !== false, options.npm !== false);
        });
};
