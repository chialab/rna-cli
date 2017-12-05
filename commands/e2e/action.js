const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const glob = require('glob');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');

/**
 * Returns testcafe options from input parameters.
 * @returns {Array} options for testcafe.
 */
let getConfig = (options) => {
    console.log(options);
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
    console.log(dependencies, config);

    // return global.Promise.all(dependencies).then(() => {
    //     let tempSource = path.join(paths.tmp, `source-${Date.now()}.js`);
    //     let tempUnit = path.join(paths.tmp, `unit-${Date.now()}.js`);
    //     fs.writeFileSync(tempSource, files.map((uri) => `import '${uri}';`).join('\n'));
    //     return app.exec('build', { // Build sources.
    //         arguments: [tempSource],
    //         output: tempUnit,
    //         map: false,
    //     }).then(() => { // Test built sources.
    //         let karmaOptions = typeof config === 'string' ?
    //             { configFile: config } :
    //             config;
    //         karmaOptions.files = [tempUnit];
    //         return new global.Promise((resolve, reject) => {
    //             let server = new karma.Server(karmaOptions, (exitCode) => {
    //                 if (exitCode && !options.server) {
    //                     reject(exitCode);
    //                 } else {
    //                     resolve();
    //                 }
    //             });
    //             server.start();
    //         });
    //     });
    // });
};
