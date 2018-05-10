const paths = require('./paths');
const which = require('npm-which')(paths.cli);
const exec = require('./exec.js');

const BIN = which.sync('yarn');

module.exports = {
    /**
     * Run `yarn install` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    update(path) {
        return exec(BIN, ['--cwd', path, 'install', '-W']);
    },

    /**
     * Run `yarn add` in project root.
     *
     * @param {String} path The project root.
     * @param {String} ...packages Packages to be added.
     * @returns {Promise}
     */
    add(path, ...packages) {
        return exec(BIN, ['--cwd', path, 'add', ...packages, '-W']);
    },

    /**
     * Run `yarn add` in cli root.
     * Useful for plugins.
     *
     * @param {String} ...packages Packages to be added.
     * @returns {Promise}
     */
    addToCli(...packages) {
        return exec(BIN, ['--cwd', paths.cli, 'add', ...packages, '-W']);
    },

    /**
     * Run `yarn add --dev` in project root.
     *
     * @param {String} path The project root.
     * @param {String} ...packages Development packages to be added.
     * @returns {Promise}
     */
    dev(path, ...packages) {
        return exec(BIN, ['--cwd', path, 'add', ...packages, '--dev', '-W']);
    },

    /**
     * Run `yarn global add`.
     *
     * @param {string} ...packages Global packages to be added.
     * @returns {Promise}
     */
    global(...packages) {
        return exec(BIN, ['global', 'add', ...packages]);
    },

    /**
     * Run `yarn remove` in project root.
     *
     * @param {String} path The project root.
     * @param {String} ...packages Packages to be removed.
     * @returns {Promise}
     */
    remove(path, ...packages) {
        return exec(BIN, ['--cwd', path, 'remove', ...packages, '-W']);
    },

    /**
     * Run `yarn start` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    start(path) {
        return exec(BIN, ['--cwd', path, 'start']);
    },

    /**
     * Run `yarn test` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    test(path) {
        return exec(BIN, ['--cwd', path, 'start']);
    },

    /**
     * Run a generic project command in project root.
     *
     * @param {String} path The project root.
     * @param {String} cmd Project command to be run.
     * @param {Array<string>} args Arguments to be passed to command.
     * @returns {Promise}
     */
    run(path, cmd, args) {
        return exec(BIN, ['--cwd', path, 'run', cmd, ...args]);
    },

    /**
     * Run `yarn init` in project root.
     *
     * @param {String} path The project root.
     * @returns {Promise}
     */
    init(path) {
        return exec(BIN, ['--cwd', path, 'init']);
    },
};
