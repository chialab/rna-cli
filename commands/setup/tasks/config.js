const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');
const configurator = require('../../../lib/configurator.js');

module.exports = (app, options) => {
    if (options.config !== false) {
        const cwd = paths.cwd;
        let editorConfig = path.join(cwd, '.editorconfig');
        let isNew = !fs.existsSync(editorConfig);
        let content = fs.readFileSync(
            path.join(paths.cli, './configs/editorconfig'),
            'utf8'
        );
        configurator(editorConfig, content, '# RNA');
        if (isNew) {
            app.log(`${colors.green('.editorconfig created.')} ${colors.grey(`(${editorConfig})`)}`);
        } else {
            app.log(`${colors.green('.editorconfig found.')} ${colors.grey(`(${editorConfig})`)}`);
        }
    }
    return global.Promise.resolve();
};