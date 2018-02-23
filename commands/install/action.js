const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to install dependencies.
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
    // Run `yarn install`.
    return manager.update(paths.cwd)
        .then((res) => {
            app.log(colors.green('dependencies successfully updated.'));
            return global.Promise.resolve(res);
        })
        .catch((err) => {
            app.log(colors.red('failed to update dependencies.'));
            return global.Promise.reject(err);
        });
};
