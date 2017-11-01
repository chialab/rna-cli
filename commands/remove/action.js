const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to remove a bunch of packages off dependencies.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = (app, options = {}) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let args = options.arguments || [];
    if (args.length === 0) {
        // Nothing to remove.
        app.log(colors.yellow(`${utils.extractRandom(['🤷‍', '🤷‍♂️'])} specify the package to remove.`));
    } else {
        // Remove requested packages.
        return manager.remove(...options.arguments)
            .then((res) => {
                app.log(colors.green('packages successfully removed.'));
                return global.Promise.resolve(res);
            })
            .catch((err) => {
                app.log(colors.red('failed to remove packages.'));
                return global.Promise.reject(err);
            });
    }
};
