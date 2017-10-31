const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');
const manager = require('../../../lib/package-manager.js');
const configurator = require('../../../lib/configurator.js');

module.exports = (app, options) => {
    let eslintPromise = global.Promise.resolve();
    if (options.linting !== false) {
        const cwd = paths.cwd;
        let eslintIgnore = path.join(cwd, '.eslintignore');
        let ignoreContent = fs.readFileSync(
            path.join(paths.cli, './configs/lint/eslintignore'),
            'utf8'
        );
        configurator(eslintIgnore, ignoreContent, '# RNA');
        let eslintConfig = path.join(cwd, '.eslintrc.yml');
        let isNew = !fs.existsSync(eslintConfig);
        let content = fs.readFileSync(
            path.join(paths.cli, './configs/lint/eslintrc.yml'),
            'utf8'
        );
        configurator(eslintConfig, content, '# RNA');
        if (isNew) {
            eslintPromise = manager.dev('eslint', 'eslint-plugin-mocha');
            app.log(`${colors.green('.eslintrc.yml created.')} ${colors.grey(`(${eslintConfig})`)}`);
        } else {
            app.log(`${colors.green('.eslintrc.yml updated.')} ${colors.grey(`(${eslintConfig})`)}`);
        }
    }
    return eslintPromise;
};