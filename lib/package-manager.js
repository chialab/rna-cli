const paths = require('./paths');
const exec = require('./exec.js');

const BIN = require.resolve('yarn/bin/yarn.js');

module.exports = {
    /**
     * Run `yarn install` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    async update(path) {
        return await exec(BIN, ['--cwd', path, 'install', '-W']);
    },

    /**
     * Run `yarn add` in project root.
     *
     * @param {String} path The project root.
     * @param {String} ...packages Packages to be added.
     * @returns {Promise}
     */
    async add(path, ...packages) {
        return await exec(BIN, ['--cwd', path, 'add', ...packages, '-W']);
    },

    /**
     * Run `yarn add` in cli root.
     * Useful for plugins.
     *
     * @param {String} ...packages Packages to be added.
     * @returns {Promise}
     */
    async addToCli(...packages) {
        return await exec(BIN, ['--cwd', paths.cli, 'add', ...packages, '-W']);
    },

    /**
     * Run `yarn add --dev` in project root.
     *
     * @param {String} path The project root.
     * @param {String} ...packages Development packages to be added.
     * @returns {Promise}
     */
    async dev(path, ...packages) {
        return await exec(BIN, ['--cwd', path, 'add', ...packages, '--dev', '-W']);
    },

    /**
     * Run `yarn global add`.
     *
     * @param {string} ...packages Global packages to be added.
     * @returns {Promise}
     */
    async global(...packages) {
        return await exec(BIN, ['global', 'add', ...packages, '--force']);
    },

    /**
     * Run `yarn global remove`.
     *
     * @param {string} ...packages Global packages to be removed.
     * @returns {Promise}
     */
    async globalUninstall(...packages) {
        return await exec(BIN, ['global', 'remove', ...packages]);
    },

    /**
     * Run `yarn remove` in project root.
     *
     * @param {String} path The project root.
     * @param {String} ...packages Packages to be removed.
     * @returns {Promise}
     */
    async remove(path, ...packages) {
        return await exec(BIN, ['--cwd', path, 'remove', ...packages, '-W']);
    },

    /**
     * Run `yarn start` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    async start(path) {
        return await exec(BIN, ['--cwd', path, 'start']);
    },

    /**
     * Run `yarn test` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    async test(path) {
        return await exec(BIN, ['--cwd', path, 'test']);
    },

    /**
     * Run a generic project command in project root.
     *
     * @param {String} path The project root.
     * @param {String} cmd Project command to be run.
     * @param {Array<string>} args Arguments to be passed to command.
     * @returns {Promise}
     */
    async run(path, cmd, args) {
        return await exec(BIN, ['--cwd', path, 'run', cmd, ...args]);
    },

    /**
     * Run `yarn init` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    async init(path) {
        return await exec(BIN, ['--cwd', path, 'init']);
    },
};
