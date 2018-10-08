const stylelint = require('stylelint');
const formatter = require('eslint/lib/formatters/stylish');

class Stylelint {
    /**
     * Get path of Stylelint config file.
     *
     * @param {CLI} app The current app instance.
     * @param {Project} project The current project.
     * @returns {string}
     */
    static detectConfigFile(app, project) {
        let localConf = project.file('.stylelintrc');
        if (localConf.exists()) {
            return localConf.path;
        }
        localConf = project.file('.stylelintrc.yml');
        if (localConf.exists()) {
            return localConf.path;
        }
        return app.navigator.file('.stylelintrc.yml').path;
    }

    constructor(options = {}) {
        this.options = Object.assign({
            syntax: 'scss',
            cache: false,
        }, options);
    }

    async lint(files = []) {
        let options = Object.assign({}, this.options, {
            files,
        });
        let report = await stylelint.lint(options);
        let errorCount = 0;
        let warningCount = 0;
        let results = report.results.map((report) => {
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
            errorCount += fileErrorCount;
            warningCount += fileWarningCount;
            return {
                filePath: report.source,
                warningCount: fileWarningCount,
                errorCount: fileErrorCount,
                messages,
            };
        });
        let res = {
            errorCount,
            warningCount,
            results,
        };
        if (this.result) {
            this.result.results.push(...res.results);
            this.result.errorCount += res.errorCount;
            this.result.warningCount += res.warningCount;
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
}

module.exports = Stylelint;
