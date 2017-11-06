const paths = require('./paths');
const which = require('npm-which')(paths.cli);
const exec = require('./exec.js');

const BIN = which.sync('yarn');

let api = {
    /**
     * Run `yarn install` in project root.
     *
     * @returns {Promise}
     */
    update() {
        return exec(`${BIN} --cwd ${paths.cwd} install -W`);
    },

    /**
     * Run `yarn add` in project root.
     *
     * @param {string} ...packages Packages to be added.
     * @returns {Promise}
     */
    add(...packages) {
        return exec(`${BIN} --cwd ${paths.cwd} add ${packages.join(' ')} -W`);
    },

    /**
     * Run `yarn add --dev` in project root.
     *
     * @param {string} ...packages Development packages to be added.
     * @returns {Promise}
     */
    dev(...packages) {
        return exec(`${BIN} --cwd ${paths.cwd} add ${packages.join(' ')} --dev -W`);
    },

    /**
     * Run `yarn remove` in project root.
     *
     * @param {string} ...packages Packages to be removed.
     * @returns {Promise}
     */
    remove(...packages) {
        return exec(`${BIN} --cwd ${paths.cwd} remove ${packages.join(' ')} -W`);
    },

    /**
     * Run `yarn start` in project root.
     *
     * @returns {Promise}
     */
    start() {
        return exec(`${BIN} --cwd ${paths.cwd} start`);
    },

    /**
     * Run a generic project command in project root.
     *
     * @param {string} cmd Project command to be run.
     * @param {Array<string>} args Arguments to be passed to command.
     * @returns {Promise}
     */
    run(cmd, args) {
        return exec(`${BIN} --cwd ${paths.cwd} run ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`);
    },

    /**
     * Run `yarn init` in project root.
     *
     * @returns {Promise}
     */
    init() {
        return exec(`${BIN} --cwd ${paths.cwd} init`);
    },
};

module.exports = api;
