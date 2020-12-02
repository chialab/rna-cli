const Stylelint = require('../../../Linters/Stylelint');

module.exports = function(options = {}) {
    return {
        postcssPlugin: 'postcss-stylelint-plugin',
        async Once(root, { result }) {
            const linter = result.linter = new Stylelint();
            await linter.setup(options.root);

            let files;
            if (result.dependencies) {
                files = [...result.dependencies];
            } else {
                files = result.opts.from ? [result.opts.from] : [];
            }
            await linter.lint(files);
        },
    };
};
