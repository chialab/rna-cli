const { createFilter } = require('rollup-pluginutils');
const ESLint = require('../../../Linters/ESLint.js');

module.exports = function eslint(opts = {}) {
    const filter = createFilter(opts.include || ['*.{js,mjs,jsx}'], opts.exclude || /node_modules/);

    const plugin = {
        name: 'eslint',

        buildStart() {
            plugin.linter = new ESLint();
        },

        async load(id) {
            if (!filter(id)) return null;

            await plugin.linter.lint([id]);

            return null;
        },
    };

    return plugin;
};
