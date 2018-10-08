const fs = require('fs-extra');
const { createFilter } = require('rollup-pluginutils');
const ESLint = require('../../../Linters/ESLint.js');

module.exports = function eslint(opts = {}) {
    const filter = createFilter(opts.include || ['*.{js,mjs,jsx}'], opts.exclude || /node_modules/);

    const plugin = {
        name: 'eslint',

        buildStart() {
            plugin.linter = new ESLint(opts.options || {});
        },

        async load(id) {
            if (!fs.existsSync(id)) {
                return null;
            }
            id = fs.realpathSync(id);
            if (!filter(id)) {
                return null;
            }

            await plugin.linter.lint([id]);

            return null;
        },
    };

    return plugin;
};
