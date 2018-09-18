const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to add a bunch of packages to dependencies.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = async function add(app, options) {
    if (!paths.cwd) {
        // Unable to detect project root.
        throw 'No project found';
    }
    let args = options.arguments || [];
    if (args.length === 0) {
        // Nothing to add.
        throw 'Specify the package to add';
    }
    // Add requested packages.
    if (options.dev) {
        return await manager.dev(paths.cwd, ...options.arguments);
    }

    await manager.add(paths.cwd, ...options.arguments);
    app.log(colors.green('packages successfully added.'));
};
