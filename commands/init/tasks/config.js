const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure EditorConfig configuration file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    if (options.config === false) {
        return;
    }
    const cwd = paths.cwd;
    let editorConfig = path.join(cwd, '.editorconfig');
    let isNew = !fs.existsSync(editorConfig);
    let content = fs.readFileSync(
        path.join(paths.cli, './configs/editorconfig'),
        'utf8'
    );

    // "Append" configuration to `.editorconfig`.
    configurator(editorConfig, content, '# RNA');

    if (isNew) {
        app.log(`${colors.green('.editorconfig created.')} ${colors.grey(`(${editorConfig})`)}`);
        return;
    }
    app.log(`${colors.green('.editorconfig found.')} ${colors.grey(`(${editorConfig})`)}`);
};
