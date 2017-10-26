const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

module.exports = (app) => {
    if (!paths.cwd) {
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    return manager.update()
        .then((res) => {
            app.log(colors.green('dependencies successfully updated.'));
            return global.Promise.resolve(res);
        })
        .catch((err) => {
            app.log(colors.red('failed to update dependencies.'));
            return global.Promise.reject(err);
        });
};