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
module.exports = async function setup(app, options) {
    // Detect directory to use as project root, and ensure it is present.
    paths.cwd = options.arguments.length ? path.resolve(process.cwd(), options.arguments[0]) : (paths.cwd || process.cwd());
    fs.ensureDirSync(paths.cwd);

    // active all flags if none is selected
    const flags = ['git', 'npm', 'lint', 'license', 'readme'];
    if (!flags.some((key) => options[key] === true)) {
        flags.forEach((key) => {
            options[key] = true;
        });
    }

    options.git && await require('./tasks/git.js')(app, options);
    options.npm && await require('./tasks/npm.js')(app, options);
    await require('./tasks/directories.js')(app, options);
    options.lint && await require('./tasks/config.js')(app, options);
    options.lint && await require('./tasks/eslint.js')(app, options);
    options.lint && await require('./tasks/stylelint.js')(app, options);
    options.license && await require('./tasks/license.js')(app, options);
    options.readme && await require('./tasks/readme.js')(app, options);
};
