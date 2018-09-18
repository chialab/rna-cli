const postcss = require('postcss');
const Stylelint = require('../../../Linters/Stylelint');

module.exports = postcss.plugin('postcss-stylelint-plugin', () => {
    const linter = new Stylelint();

    return async(root, result) => {
        await linter.lint([result.opts.from]);
        result.linter = linter;
    };
});
