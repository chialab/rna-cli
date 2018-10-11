const fs = require('fs-extra');
const Linter = require('eslint').CLIEngine;
const formatter = require('eslint/lib/formatters/stylish');

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
        let config = Object.assign({
            cache: true,
            cwd: project.path,
        }, options);
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
        this.options = Object.assign({}, options);
        this.linter = new Linter(this.options);
    }

    async lint(files = []) {
        let res = this.linter.executeOnFiles(files);
        if (this.result) {
            this.result.results.push(...res.results);
            this.result.errorCount += res.errorCount;
            this.result.warningCount += res.warningCount;
            this.result.fixableErrorCount += res.fixableErrorCount;
            this.result.fixableWarningCount += res.fixableWarningCount;
        } else {
            this.result = res;
        }
        if (this.options.fix) {
            await this.fix();
        }
        return this.result;
    }

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
