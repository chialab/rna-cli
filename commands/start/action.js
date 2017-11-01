const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to run `yarn start`.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise}
 */
module.exports = (app) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    return manager.start();
};
