const cli = require('../../lib/paths').cli;
const exec = require('../../lib/exec.js');
const which = require('npm-which')(cli);

const BIN = which.sync('lerna');

module.exports = (program) => {
    program
        .command('publish')
        .description('Publish to NPM.')
        .option('--exact', 'Update packages dependencies using exact version')
        .option('--beta', 'Deploy a beta version of the packages.')
        .option('--no-git', 'Do not commit version changes to Git.')
        .option('--no-npm', 'Do not commit version changes to NPM.')
        .help(`Use \`lerna\` to handle to publish monorepos.
`)
        .action((app, options) => {
            let args = ['publish', '--use-workspaces'];
            if (options.beta) {
                args.push('--canary');
                if (!options.hasOwnProperty('exact')) {
                    options.exact = true;
                }
            }
            if (options.exact) {
                args.push('--exact');
            }
            if (options.git === false) {
                args.push('--skip-git');
            }
            if (options.npm === false) {
                args.push('--skip-npm');
            }
            if (process.env.CI) {
                args.push('--yes');
            }
            return exec(`${BIN} ${args.join(' ')}`);
        });
};