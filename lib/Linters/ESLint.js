const fs = require('fs-extra');
const path = require('path');
const Linter = require('eslint').CLIEngine;
const formatter = require('eslint/lib/formatters/stylish');
const { cwd, cli } = require('../paths.js');

/**
 * Get path of ESLint config file.
 *
 * @returns {string}
 */
function getConfig() {
    let localConf = path.join(cwd, '.eslintrc.yml');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
    return path.join(cli, 'configs/lint/eslintrc.yml');
}

module.exports = class ESLint {
    constructor(options = {}) {
        this.options = Object.assign({
            configFile: getConfig(),
            cwd,
            cache: true,
        }, options);
        this.linter = new Linter(this.options);
    }

    async lint(files = []) {
        this.result = this.linter.executeOnFiles(files);
        return this.result;
    }

    report() {
        return formatter(this.result);
    }
};
