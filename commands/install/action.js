const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to install dependencies.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = async(app) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }
    // Run `yarn install`.
    await manager.update(paths.cwd);
    app.log(colors.green('dependencies successfully updated.'));
};
