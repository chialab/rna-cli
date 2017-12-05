const paths = require('./paths');
const which = require('npm-which')(paths.cli);
const exec = require('./exec.js');

const BIN = which.sync('testcafe');

let api = {
    /**
     * Run testcafe in project root with given parameters.
     * @param {String} parameters => given parameters as string.
     * @returns {Promise}
     */
    testcafe(parameters) {
        return exec(`${BIN} ${parameters}`);
    },
};

module.exports = api;
