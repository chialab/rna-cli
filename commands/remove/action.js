const colors = require('colors/safe');
const manager = require('../../lib/package-manager.js');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

module.exports = (app, options = {}) => {
    if (!paths.cwd) {
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let args = options.arguments || [];
    if (args.length === 0) {
        app.log(colors.yellow(`${utils.extractRandom(['🤷‍', '🤷‍♂️'])} specify the package to remove.`));
    } else {
        return manager.remove(...options.arguments)
            .then((res) => {
                app.log(colors.green('packages successfully removed.'));
                return global.Promise.resolve(res);
            })
            .catch((err) => {
                app.log(colors.red('failed to remove packages.'));
                return global.Promise.reject(err);
            });
    }
};