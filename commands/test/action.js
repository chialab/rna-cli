const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to run `yarn test`.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async() => {
    if (!paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }
    return await manager.test(paths.cwd);
};
