const formatter = require('eslint/lib/formatters/stylish');

/**
 * @typedef {Object} LintResult
 * @property {Array<Object>} results
 * @property {number} errorCount
 * @property {number} warningCount
 * @property {number} fixableErrorCount
 * @property {number} fixableWarningCount
 */

/**
 * Base Linter class.
 */
class Linter {
    /**
     * Merge two lint results.
     *
     * @param {LintResult} result1
     * @param {LintResult} result2
     * @return {LintResult} A new LintResult.
     */
    static merge(result1, result2) {
        return {
            results: (result1.results || []).concat((result2.results || [])),
            errorCount: (result1.errorCount || 0) + (result2.errorCount || 0),
            warningCount: (result1.warningCount || 0) + (result2.warningCount || 0),
            fixableErrorCount: (result1.fixableErrorCount || 0) + (result2.fixableErrorCount || 0),
            fixableWarningCount: (result1.fixableWarningCount || 0) + (result2.fixableWarningCount || 0),
        };
    }

    /**
     * Create a report of the lint result.
     *
     * @param {LintResult} report The lint result to print.
     * @return {string}
     */
    static format(result) {
        return formatter(result.results);
    }

    /**
     * Setup the linter.
     * @param {Project} project The project to lint.
     * @return {Promise<void>}
     */
    async setup(/* project */) {
        //
    }

    /**
     * Execute lint on files.
     * If `fix` configuration has been passed, try to fix warnings.
     * @param {Array<string>} files A list of files to lint.
     * @return {Promise<LintResult>}
     */
    async lint(/* files */) {
        return this.result = {
            results: [],
            errorCount: 0,
            warningCount: 0,
            fixableErrorCount: 0,
            fixableWarningCount: 0,
        };
    }

    /**
     * Execute warnings fix.
     * @return {Promise<void>}
     */
    async fix() {
        //
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
}

module.exports = Linter;
