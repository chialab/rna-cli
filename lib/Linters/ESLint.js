const Linter = require('eslint').CLIEngine;
const formatter = require('eslint/lib/formatters/stylish');

class ESLint {
    /**
     * Get path of ESLint config file.
     *
     * @param {CLI} app The current app instance.
     * @param {Project} project The current project.
     * @returns {string}
     */
    static detectConfigFile(app, project) {
        let localConf = project.file('.eslintrc.yml');
        if (localConf.exists()) {
            return localConf.path;
        }
        return app.navigator.file('.eslintrc.yml').path;
    }

    constructor(options = {}) {
        this.options = Object.assign({
            cache: true,
        }, options);
        this.linter = new Linter(this.options);
    }

    async lint(files = []) {
        let res = this.linter.executeOnFiles(files);
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

module.exports = ESLint;
