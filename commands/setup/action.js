const fs = require('fs-extra');
const path = require('path');
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
    fs.ensureDirSync(paths.cwd);

    return require('./tasks/git.js')(app, options)
        .then(() => require('./tasks/npm.js')(app, options))
        .then(() => require('./tasks/directories.js')(app, options))
        .then(() => require('./tasks/config.js')(app, options))
        .then(() => require('./tasks/eslint.js')(app, options))
        .then(() => require('./tasks/stylelint.js')(app, options))
        .then(() => require('./tasks/license.js')(app, options))
        .then(() => require('./tasks/readme.js')(app, options));
};
