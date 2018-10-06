const fs = require('fs-extra');
const path = require('path');

/**
 * Command action to setup a new project.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function setup(app, options) {
    // Detect directory to use as project root, and ensure it is present.
    let cwd;
    if (options.arguments.length) {
        cwd = path.resolve(process.cwd(), options.arguments[0]);
    } else {
        cwd = process.cwd();
    }
    fs.ensureDirSync(cwd);

    // active all flags if none is selected
    const flags = ['git', 'npm', 'lint', 'license', 'readme'];
    if (!flags.some((key) => options[key] === true)) {
        flags.forEach((key) => {
            options[key] = true;
        });
    }

    options.git && await require('./tasks/git.js')(app, cwd, options);
    options.npm && await require('./tasks/npm.js')(app, cwd, options);
    await require('./tasks/directories.js')(app, cwd, options);
    options.lint && await require('./tasks/config.js')(app, cwd, options);
    options.lint && await require('./tasks/eslint.js')(app, cwd, options);
    options.lint && await require('./tasks/stylelint.js')(app, cwd, options);
    options.license && await require('./tasks/license.js')(app, cwd, options);
    options.readme && await require('./tasks/readme.js')(app, cwd, options);
};
