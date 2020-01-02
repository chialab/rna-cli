const { existsSync, promises: { realpath } } = require('fs');
const { createFilter } = require('rollup-pluginutils');
const ESLint = require('../../../Linters/ESLint.js');

module.exports = function eslint(options = {}) {
    const filter = createFilter(options.include || ['*.{js,mjs,jsx}'], options.exclude || /node_modules/);
    const linter = new ESLint();

    const plugin = {
        name: 'eslint',

        linter,

        async buildStart() {
            await linter.setup(options.project);
        },

        async load(id) {
            if (!existsSync(id)) {
                return null;
            }
            id = await realpath(id);
            if (!filter(id)) {
                return null;
            }

            await linter.lint([id]);

            return null;
        },
    };

    return plugin;
};
