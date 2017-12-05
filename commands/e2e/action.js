const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const glob = require('glob');
const paths = require('../../lib/paths.js');
const testcafe_manager = require('../../lib/testcafe_manager.js');
const optionsUtils = require('../../lib/options.js');

const SLOW_TESTCAFE_DEFAULT_SPEED = 0.5;

/**
 * Returns testcafe options from input parameters.
 * @returns {Array} options for testcafe.
 */
let getConfig = (options) => {
    let testcafe_conf = '';
    if (options.slow) {
        testcafe_conf += ` ${SLOW_TESTCAFE_DEFAULT_SPEED}`;
    }
    if (options.debug) {
        testcafe_conf += ' --debug';
    }
    return testcafe_conf;
}


/**
 * Command action to run tests.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options = {}) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }

    // Load options.
    options = Proteins.clone(options);
    // options.ci = options.hasOwnProperty('ci') ? options.ci : process.env.CI; // Is this CI environment?
    let config = getConfig(options);

    // Load list of files to be tested.
    let files = [];
    let filter = optionsUtils.handleArguments(options);
    filter.files.forEach((f) => files.push(...glob.sync(f)));
    Object.values(filter.packages)
        .forEach((pkg) =>
            files.push(...glob.sync(
                path.join(pkg.path, '**/e2e/**/*.js'))
            )
        );

    if (!files.length) {
        app.log(colors.yellow('no e2e tests found.'));
        return global.Promise.resolve();
    }

    let dependencies = [];
    let tempSource = path.join(paths.tmp, `source-${Date.now()}.js`);
    let tempUnit = path.join(paths.tmp, `unit-${Date.now()}.js`);
    return global.Promise.all(dependencies).then(() => {
        return app.exec('build', { // Build sources.
            arguments: [tempSource],
            output: tempUnit,
            map: false,
        }).then(() => { // Test built sources.
            return testcafe_manager.testcafe(config);
        });

    });
};
