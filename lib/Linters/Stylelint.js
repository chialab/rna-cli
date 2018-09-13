const fs = require('fs-extra');
const path = require('path');
const stylelint = require('stylelint');
const formatter = require('eslint/lib/formatters/stylish');
const { cwd, cli } = require('../paths.js');

/**
 * Get path of ESLint config file.
 *
 * @returns {string}
 */
function getConfig() {
    let localConf = path.join(cwd, '.stylelintrc');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
    localConf = path.join(cwd, '.stylelintrc.yml');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
    return path.join(cli, 'configs/lint/stylelintrc.yml');
}

module.exports = class Stylelint {
    constructor(options = {}) {
        this.options = Object.assign({
            configFile: getConfig(),
            syntax: 'scss',
            cache: true,
        }, options);
    }

    async lint(files = []) {
        let report = await stylelint.lint(Object.assign({}, this.options, {
            files,
        }));
        this.result = report.results.map((report) => {
            let fileErrorCount = 0;
            let fileWarningCount = 0;
            let messages = report.warnings.map((warn) => {
                if (warn.severity === 'error') {
                    fileErrorCount++;
                } else {
                    fileWarningCount++;
                }
                return {
                    ruleId: warn.rule,
                    severity: warn.severity === 'error' ? 2 : 1,
                    line: warn.line,
                    column: warn.column,
                    message: warn.text.replace(/\s\([a-z-/]*\)/, ''),
                };
            });
            return {
                filePath: report.source,
                warningCount: fileWarningCount,
                errorCount: fileErrorCount,
                messages,
            };
        });
        return this.result;
    }

    report() {
        return formatter(this.result);
    }
};
