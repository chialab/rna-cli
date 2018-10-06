const colors = require('colors/safe');
const PackageManager = require('../../lib/PackageManager.js');

/**
 * Command action to remove a bunch of packages off dependencies.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = async function remove(app, options = {}) {
    const manager = new PackageManager();
    // Remove requested packages.
    await manager.remove(...options.arguments);
    app.log(colors.green('packages successfully removed.'));
};
