const fs = require('fs-extra');
const path = require('path');
const Linter = require('./Linter');

/**
 * @class ESLint
 * Run eslint with RNA configuration.
 */
class ESLint extends Linter {
    /**
     * @inheritdoc
     */
    async setup(project) {
        let parent = project && project.parent;
        let configFile = [
            project && project.file('.eslintrc.yml'),
            parent && parent.file('.eslintrc.yml'),
            path.resolve(__dirname, '../../.eslintrc.yml'),
        ].find((file) => file && file.exists());

        let Linter;
        try {
            let linterPath = require.resolve('eslint', {
                paths: [project.path],
            });
            Linter = require(linterPath).CLIEngine;
        } catch (error) {
            Linter = require('eslint').CLIEngine;
        }

        this.config = {
            configFile: configFile && configFile.path,
            cache: true,
            cwd: parent ? parent.path : project.path,
        };

        this.linter = new Linter(this.config);
    }

    /**
     * @inheritdoc
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
     * @inheritdoc
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
}

module.exports = ESLint;
