const Stylelint = require('../../../Linters/Stylelint');

module.exports = function(options = {}) {
    let linter = new Stylelint();
    let setup = linter.setup(options.root);

    return {
        postcssPlugin: 'postcss-stylelint-plugin',
        async Once(root, { result }) {
            let files;
            if (result.dependencies) {
                files = [...result.dependencies];
            } else {
                files = result.opts.from ? [result.opts.from] : [];
            }
            await setup;
            await linter.lint(files);
        },
    };
};
