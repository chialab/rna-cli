const colors = require('colors/safe');
const PackageManager = require('../../lib/PackageManager.js');

/**
 * Command action to install dependencies.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async function install(app) {
    const manager = new PackageManager();
    // Run `yarn install`.
    await manager.install();
    app.log(colors.green('dependencies successfully updated.'));
};
