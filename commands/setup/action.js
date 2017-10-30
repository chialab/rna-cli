const path = require('path');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

module.exports = (app, options) => {
    paths.cwd = options.arguments.length ? path.resolve(process.cwd(), options.arguments[0]) : paths.cwd;
    utils.ensureDir(paths.cwd);
    return require('./tasks/git.js')(app, options)
        .then(() => require('./tasks/npm.js')(app, options))
        .then(() => require('./tasks/directories.js')(app, options))
        .then(() => require('./tasks/config.js')(app, options))
        .then(() => require('./tasks/eslint.js')(app, options))
        .then(() => require('./tasks/sasslint.js')(app, options))
        .then(() => require('./tasks/license.js')(app, options))
        .then(() => require('./tasks/readme.js')(app, options));
};