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
        if (parameters.indexOf('--list-browsers') !== -1) {
            return exec(`${BIN} ${parameters}`);
        }
        return exec(`${BIN} ${parameters} e2e/*.js`);
    },
};

module.exports = api;
