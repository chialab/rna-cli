const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const paths = require('../../lib/paths.js');

module.exports = (app) => {
    if (!paths.cwd) {
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    return manager.start();
};