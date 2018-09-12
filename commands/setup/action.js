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
module.exports = async(app, options) => {
    // Detect directory to use as project root, and ensure it is present.
    paths.cwd = options.arguments.length ? path.resolve(process.cwd(), options.arguments[0]) : (paths.cwd || process.cwd());
    fs.ensureDirSync(paths.cwd);

    await require('./tasks/git.js')(app, options);
    await require('./tasks/npm.js')(app, options);
    await require('./tasks/directories.js')(app, options);
    await require('./tasks/config.js')(app, options);
    await require('./tasks/eslint.js')(app, options);
    await require('./tasks/stylelint.js')(app, options);
    await require('./tasks/license.js')(app, options);
    await require('./tasks/readme.js')(app, options);
};
