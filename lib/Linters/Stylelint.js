const path = require('path');
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
    async setup(project) {
        let parent = project && project.parent;
        let configFile = [
            project && project.file('.stylelintrc'),
            project && project.file('.stylelintrc.yml'),
            parent && parent.file('.stylelintrc'),
            parent && parent.file('.stylelintrc.yml'),
            path.resolve(__dirname, '../../.stylelintrc.yml'),
        ].find((file) => file && file.exists());

        this.config = {
            syntax: 'scss',
            cache: false,
            configFile: configFile && configFile.path,
        };
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
        let config = Object.assign({}, this.config, {
            files,
        });
        // run stylelint.
        let report = await stylelint.lint(config);
        // transform stylelint report to LintResult.
        let res = this.transformResult(report);
        if (this.result) {
            // collect multiple execution results.
            this.result.results.push(...res.results);
            this.result.errorCount += res.errorCount;
            this.result.warningCount += res.warningCount;
        } else {
            this.result = res;
        }
        return this.result;
    }
}

module.exports = Stylelint;
