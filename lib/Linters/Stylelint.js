const fs = require('fs');
const stylelint = require('stylelint');
const Linter = require('./Linter');

/**
 * @class Stylelint
 * Run stylelint with RNA configuration.
 */
class Stylelint extends Linter {
    /**
     * @inheritdoc
     */
    async setup(project, options = {}) {
        let parent = project && await project.getParent();

        let configFile;
        if (project && await project.file('.stylelintrc').exists()) {
            configFile = project.file('.stylelintrc');
        } else if (project && await project.file('.stylelintrc.yml').exists()) {
            configFile = project.file('.stylelintrc.yml');
        } else if (parent && await parent.file('.stylelintrc').exists()) {
            configFile = parent.file('.stylelintrc');
        } else if (parent && await parent.file('.stylelintrc.yml').exists()) {
            configFile = parent.file('.stylelintrc.yml');
        }

        this.config = Object.assign({
            syntax: 'scss',
            cache: false,
            configFile: configFile && configFile.path,
            disableDefaultIgnores: true,
            globbyOptions: {
                expandDirectories: false,
            },
        }, options);
    }

    /**
     * Transform stylelint report to LintResult object.
     * @private
     * @param {Object} report Stylelint report.
     * @return {LintResult}
     */
    transformResult(report) {
        let errorCount = 0;
        let warningCount = 0;
        let results = report.results.map((result) => {
            let fileErrorCount = 0;
            let fileWarningCount = 0;
            let messages = result.warnings.map((warn) => {
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
            errorCount += fileErrorCount;
            warningCount += fileWarningCount;
            return {
                filePath: result.source,
                warningCount: fileWarningCount,
                errorCount: fileErrorCount,
                messages,
            };
        });
        return {
            errorCount,
            warningCount,
            results,
        };
    }

    /**
     * @inheritdoc
     */
    async lint(files = []) {
        files = files.filter((file) => fs.existsSync(file));
        if (!files.length) {
            return this.result;
        }
        const config = Object.assign({}, this.config, {
            files,
        });
        // run stylelint.
        const report = await stylelint.lint(config);
        // transform stylelint report to LintResult.
        const res = this.transformResult(report);
        if (this.result) {
            // collect multiple execution results.
            this.result = Linter.merge(this.result, res);
        } else {
            this.result = res;
        }
        return this.result;
    }
}

module.exports = Stylelint;
