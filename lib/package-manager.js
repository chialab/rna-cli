const paths = require('./paths');
const which = require('npm-which')(paths.cli);
const exec = require('./exec.js');

const BIN = which.sync('yarn');

let api = {
    update() {
        return exec(`${BIN} --cwd ${paths.cwd} install`);
    },

    add(...packages) {
        return exec(`${BIN} --cwd ${paths.cwd} add ${packages.join(' ')}`);
    },

    remove(...packages) {
        return exec(`${BIN} --cwd ${paths.cwd} remove ${packages.join(' ')}`);
    },

    start() {
        return exec(`${BIN} --cwd ${paths.cwd} start`);
    },

    run(cmd, args) {
        return exec(`${BIN} --cwd ${paths.cwd} run ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`);
    },

    init() {
        return exec(`${BIN} --cwd ${paths.cwd} init`);
    },
};

module.exports = api;