const PackageManager = require('../../lib/package-manager.js');

/**
 * Command action to run `yarn test`.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async function test() {
    const manager = new PackageManager();
    return await manager.test();
};
