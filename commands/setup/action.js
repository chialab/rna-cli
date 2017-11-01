const path = require('path');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

/**
 * Command action to setup a new project.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    // Detect directory to use as project root, and ensure it is present.
    paths.cwd = options.arguments.length ? path.resolve(process.cwd(), options.arguments[0]) : (paths.cwd || process.cwd());
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
