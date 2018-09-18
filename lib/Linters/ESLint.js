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
        let res = this.linter.executeOnFiles(files);
        if (this.result) {
            this.result.results.push(...res.results);
            this.result.errorCount = res.errorCount;
            this.result.warningCount = res.warningCount;
        } else {
            this.result = res;
        }
        return this.result;
    }

    hasErrors() {
        return this.result && this.result.errorCount;
    }

    hasWarnings() {
        return this.result && this.result.warningCount;
    }

    report(report) {
        return formatter(report ? report.results : this.result.results);
    }
};
