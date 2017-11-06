const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to add a bunch of packages to dependencies.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = (app, options) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let args = options.arguments || [];
    if (args.length === 0) {
        // Nothing to add.
        app.log(colors.yellow(`${utils.extractRandom(['🤷‍', '🤷‍♂️'])} specify the package to add.`));
    } else {
        // Add requested packages.
        let request = options.dev ? manager.dev(...options.arguments) : manager.add(...options.arguments);
        return request
            .then((res) => {
                app.log(colors.green('packages successfully added.'));
                return global.Promise.resolve(res);
            })
            .catch((err) => {
                app.log(colors.red('failed to add packages.'));
                return global.Promise.reject(err);
            });
    }
};
