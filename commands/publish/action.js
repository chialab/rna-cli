const exec = require('../../lib/exec.js');

const BIN = require.resolve('lerna/cli.js');

/**
 * Command action to publish modules to NPM.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
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
    return exec(BIN, args);
};
