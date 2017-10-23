const cli = require('./paths').cli;
const exec = require('./exec.js');
const which = require('npm-which')(cli);

const BIN = which.sync('yarn');

let api = {
    update() {
        return exec(`${BIN} install`);
    },

    add(...packages) {
        return exec(`${BIN} add ${packages.join(' ')}`);
    },

    remove(...packages) {
        return exec(`${BIN} remove ${packages.join(' ')}`);
    },

    start() {
        return exec(`${BIN} start`);
    },

    run(cmd, args) {
        return exec(`${BIN} run ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`);
    },
};

module.exports = api;