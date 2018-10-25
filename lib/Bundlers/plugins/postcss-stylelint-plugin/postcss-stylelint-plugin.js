const postcss = require('postcss');
const Stylelint = require('../../../Linters/Stylelint');

module.exports = postcss.plugin('postcss-stylelint-plugin', (options = {}) =>
    async (root, result) => {
        const linter = new Stylelint(options);

        let files = [result.opts.from];
        if (result.dependencies) {
            files.push(...result.dependencies);
        }

        await linter.lint(files);
        result.linter = linter;
    }
);
