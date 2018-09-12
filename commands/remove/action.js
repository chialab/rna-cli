const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to remove a bunch of packages off dependencies.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = async(app, options = {}) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }
    let args = options.arguments || [];
    if (args.length === 0) {
        // Nothing to remove.
        throw 'Specify the package to remove.';
    }
    // Remove requested packages.
    await manager.remove(paths.cwd, ...options.arguments);
    app.log(colors.green('packages successfully removed.'));
};
