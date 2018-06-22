const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');

/**
 * Check if an update is available and install it.
 *
 * @param {CLI} app CLI instance.
 * @returns {Promise|void}
 */
module.exports = (app) =>
    app.checkUpdate()
        .then((version) =>
            manager.globalUninstall(app.pkg)
                .then(() =>
                    manager.global(app.pkg)
                        .then(() => {
                            app.log(colors.green(`Updated to version ${version}!`));
                            return global.Promise.resolve();
                        })
                        .catch((err) => {
                            app.log(colors.red(`Error updating to version ${version}!`));
                            return global.Promise.reject(err);
                        })
                )
        )
        .catch(() => global.Promise.resolve());
