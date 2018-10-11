const Linter = require('eslint').CLIEngine;
const formatter = require('eslint/lib/formatters/stylish');

class ESLint {
    /**
     * Get ESLint config for project.
     *
     * @param {CLI} app The current app instance.
     * @param {Project} project The current project.
     * @returns {Object}
     */
    static detectConfig(app, project) {
        let config = {
            cwd: project.path,
        };
        let localConf = project.file('.eslintrc.yml');
        if (localConf.exists()) {
            config.configFile = localConf.path;
        } else {
            let parent = project.parent;
            if (parent) {
                localConf = parent.file('.eslintrc.yml');
                if (localConf.exists()) {
                    config.configFile = localConf.path;
                    config.cwd = parent.path;
                }

            }
        }
        config.configFile = config.configFile || app.navigator.file('.eslintrc.yml').path;
        return config;
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

    report() {
        return formatter(this.result.results);
    }
}

module.exports = ESLint;
