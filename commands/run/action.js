const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to run a project command.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async function run() {
    if (!paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }
    return await manager.run(paths.cwd, process.argv[3], process.argv.slice(4));
};
