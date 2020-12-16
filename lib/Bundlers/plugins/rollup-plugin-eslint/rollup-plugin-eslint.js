const { promises: { realpath, stat } } = require('fs');
const { createFilter } = require('@rollup/pluginutils');
const ESLint = require('../../../Linters/ESLint');

module.exports = function eslint(options = {}) {
    const filter = createFilter(options.include || ['*.{js,mjs,jsx}'], options.exclude || /node_modules/);
    const linter = new ESLint();

    return {
        name: 'eslint',

        linter,

        async buildStart() {
            await linter.setup(options.project);
        },

        async load(id) {
            try {
                if (!(await stat(id)).isFile()) {
                    return null;
                }
                id = await realpath(id);
                if (!filter(id)) {
                    return null;
                }

                await linter.lint([id]);
            } catch (err) {
                //
            }

            return null;
        },
    };
};
