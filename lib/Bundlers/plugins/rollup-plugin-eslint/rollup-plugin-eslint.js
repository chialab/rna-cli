const fs = require('fs-extra');
const { createFilter } = require('rollup-pluginutils');
const ESLint = require('../../../Linters/ESLint.js');

module.exports = function eslint(options = {}) {
    const filter = createFilter(options.include || ['*.{js,mjs,jsx}'], options.exclude || /node_modules/);
    let linter = new ESLint();

    const plugin = {
        name: 'eslint',

        linter,

        async buildStart() {
            await linter.setup(options.root && options.root.project);
        },

        async load(id) {
            if (!fs.existsSync(id)) {
                return null;
            }
            id = fs.realpathSync(id);
            if (!filter(id)) {
                return null;
            }

            await linter.lint([id]);

            return null;
        },
    };

    return plugin;
};
