const stylelint = require('stylelint');
const formatter = require('eslint/lib/formatters/stylish');

/**
 * @typedef {Object} LintResult
 * @property {Array<Object>} results
 * @property {number} errorCount
 * @property {number} warningCount
 */

/**
 * @class Stylelint
 * Run stylelint with RNA configuration.
 */
class Stylelint {
    /**
     * Get Stylelint config for project.
     *
     * @param {CLI} app The current app instance.
     * @param {Project} project The current project.
     * @param {Object} options Given options.
     * @returns {Object}
     */
    static detectConfig(app, project, options) {
        let config = Object.assign({
            syntax: 'scss',
            cache: false,
        }, options);
        let parent = project.parent;

        let configFile = [
            project.file('.stylelintrc'),
            project.file('.stylelintrc.yml'),
            parent && parent.file('.stylelintrc'),
            parent && parent.file('.stylelintrc.yml'),
            app.navigator.file('.stylelintrc.yml'),
        ].find((file) => file && file.exists());

        if (configFile) {
            config.configFile = configFile.path;
        }

        return config;
    }

    /**
     * Create a Stylelint instance.
     *
     * @param {Object} config Stylelint configuration.
     * @return {Stylelint}
     */
    constructor(config = {}) {
        this.config = Object.assign({}, config);
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
     * Execute lint on files.
     * If `fix` configuration has been passed, try to fix warnings.
     * @param {Array<string>} files A list of files to lint.
     * @return {Promise<LintResult>}
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

    /**
     * Check if linter detected errors.
     * @return {boolean}
     */
    hasErrors() {
        return this.result && !!this.result.errorCount;
    }

    /**
     * Check if linter detected warning.
     * @return {boolean}
     */
    hasWarnings() {
        return this.result && !!this.result.warningCount;
    }

    /**
     * Create a report of the lint result.
     * @return {string}
     */
    report() {
        return formatter(this.result.results);
    }
}

module.exports = Stylelint;
