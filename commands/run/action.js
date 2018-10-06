const PackageManager = require('../../lib/PackageManager.js');

/**
 * Command action to run a project command.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async function run() {
    const manager = new PackageManager();
    return await manager.run(process.argv[3], process.argv.slice(4));
};
