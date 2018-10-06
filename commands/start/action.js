const PackageManager = require('../../lib/package-manager.js');

/**
 * Command action to run `yarn start`.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async function start() {
    const manager = new PackageManager();
    return await manager.start();
};
