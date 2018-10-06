const colors = require('colors/safe');
const PackageManager = require('../../lib/PackageManager.js');

/**
 * Command action to add a bunch of packages to dependencies.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = async function add(app, options) {
    const manager = new PackageManager();
    // Add requested packages.
    if (options.dev) {
        return await manager.dev(...options.arguments);
    }

    await manager.add(...options.arguments);
    app.log(colors.green('packages successfully added.'));
};
