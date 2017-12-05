const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const glob = require('glob');
const paths = require('../../lib/paths.js');
const testcafe_manager = require('../../lib/testcafe-manager.js');
const optionsUtils = require('../../lib/options.js');

const SLOW_TESTCAFE_DEFAULT_SPEED = 0.5;

/**
 * Returns testcafe options based on input parameters.
 * @returns {Array} options for testcafe.
 */
let getConfig = (options) => {
    if (options.browserslist) {
        return '--list-browsers';
    }
    let testcafe_conf = '';
    if (options.browser && options.browser != true) {
        testcafe_conf = options.browser;
    } else {
        testcafe_conf = 'chrome'; // default browser: chrome
    }
    if (options.slow) {
        if (options.slow > 0 && options.slow < 1) {
            testcafe_conf += ` --speed ${options.slow}`;
        } else {
            testcafe_conf += ` --speed ${SLOW_TESTCAFE_DEFAULT_SPEED}`;
        }
    }
    if (options.debug) {
        testcafe_conf += ' --debug-mode';
    }
    if (options.proxy) {
        testcafe_conf += ` --proxy ${options.proxy}`;
    }
    return testcafe_conf;
};


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
    let config = getConfig(options);

    // Load list of files to be tested.
    let files = [];
    let filter = optionsUtils.handleArguments(options);
    filter.files.forEach((f) => files.push(...glob.sync(f)));
    Object.values(filter.packages)
        .forEach((pkg) =>
            files.push(...glob.sync(
                path.join(pkg.path, '{test,tests}/e2e/**/*.js'))
            )
        );
    if (!files.length) {
        app.log(colors.yellow('no e2e tests found.'));
        return global.Promise.resolve();
    }

    let dependencies = []; //TODO need dependencies?
    return global.Promise.all(dependencies)
        .then(() => app.exec('build'))
        .then(() => app.exec('serve'))
        .then((res) => testcafe_manager.testcafe(config).then(() => res.bs.exit()));
};
