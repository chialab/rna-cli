const fs = require('fs-extra');
const Linter = require('eslint').CLIEngine;
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
 * @class ESLint
 * Run eslint with RNA configuration.
 */
class ESLint {
    /**
     * Get ESLint config for project.
     *
     * @param {CLI} app The current app instance.
     * @param {Project} project The current project.
     * @param {Object} options Given options.
     * @returns {Object}
     */
    static detectConfig(app, project, options) {
        let parent = project.parent;
        let configFile = [
            project.file('.eslintrc.yml'),
            parent && parent.file('.eslintrc.yml'),
            app.navigator.file('.eslintrc.yml'),
        ].find((file) => file && file.exists());

        return Object.assign({
            configFile: configFile.path,
            cache: true,
        }, options);
    }

    /**
     * Create an ESLint instance.
     *
     * @param {Object} config ESLint configuration.
     * @return {ESLint}
     */
    constructor(config = {}) {
        this.config = Object.assign({}, config);
        // instantiate the ESLint object.
        this.linter = new Linter(this.config);
    }

    /**
     * Execute lint on files.
     * If `fix` configuration has been passed, try to fix warnings.
     * @param {Array<string>} files A list of files to lint.
     * @return {Promise<LintResult>}
     */
    async lint(files = []) {
        let res = this.linter.executeOnFiles(files);
        if (this.result) {
            // collect multiple execution results.
            this.result.results.push(...res.results);
            this.result.errorCount += res.errorCount;
            this.result.warningCount += res.warningCount;
            this.result.fixableErrorCount += res.fixableErrorCount;
            this.result.fixableWarningCount += res.fixableWarningCount;
        } else {
            this.result = res;
        }
        if (this.config.fix) {
            // exec fix
            await this.fix();
        }
        return this.result;
    }

    /**
     * Execute warnings fix.
     * @return {Promise}
     */
    async fix() {
        if (!this.result) {
            return;
        }
        this.result.results.forEach((result) => {
            if (result.output) {
                fs.writeFileSync(result.filePath, result.output);
            }
        });
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

module.exports = ESLint;
