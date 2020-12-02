const { promises: { writeFile } } = require('fs');
const Linter = require('./Linter');

/**
 * @class ESLint
 * Run eslint with RNA configuration.
 */
class ESLint extends Linter {
    /**
     * @inheritdoc
     */
    async setup(project, options = {}) {
        let parent = project && await project.getParent();
        let cwd = parent ? parent.path : project.path;
        let configFile;
        if (project && await project.file('.eslintrc.yml').exists()) {
            configFile = project.file('.eslintrc.yml');
        } else if (parent && await parent.file('.eslintrc.yml').exists()) {
            configFile = parent.file('.eslintrc.yml');
        }

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
            cwd,
            resolvePluginsRelativeTo: cwd,
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
