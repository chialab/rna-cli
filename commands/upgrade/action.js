const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');

/**
 * Check if an update is available and install it.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise|void}
 */
module.exports = async function upgrade(app) {
    let version = await app.checkUpdate();
    if (version) {
        await manager.global(app.pkg);
        app.log(colors.green(`Updated to version ${version}!`));
    }
};
