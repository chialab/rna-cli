const { promises: { writeFile } } = require('fs');
const path = require('path');
const Linter = require('./Linter');
const { File } = require('../File');

/**
 * @class ESLint
 * Run eslint with RNA configuration.
 */
class ESLint extends Linter {
    /**
     * @inheritdoc
     */
    async setup(project, options = {}) {
        let parent = project && project.parent;
        let configFile = [
            project && project.file('.eslintrc.yml'),
            parent && parent.file('.eslintrc.yml'),
            new File(path.resolve(__dirname, '../../.eslintrc.yml')),
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

        this.config = Object.assign({
            configFile: configFile && configFile.path,
            cache: true,
            cwd: parent ? parent.path : project.path,
        }, options);

        this.linter = new Linter(this.config);
    }

    /**
     * @inheritdoc
     */
    async lint(files = []) {
        let res = this.linter.executeOnFiles(files);
        if (this.result) {
            // collect multiple execution results.
            this.result = Linter.merge(this.result, res);
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
        await Promise.all(
            this.result.results.map(async (result) => {
                if (!result.output) {
                    return;
                }
                await writeFile(result.filePath, result.output);
            })
        );
    }
}

module.exports = ESLint;
