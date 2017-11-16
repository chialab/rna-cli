const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');
const utils = require('../../lib/utils.js');
const bundle = require('./bundlers/rollup.js');
const sass = require('./bundlers/sass.js');
const watcher = require('../../lib/watcher.js');

/**
 * Command action to build sources.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 *
 * @namespace options
 * @property {Boolean} production Should bundle files for production.
 * @property {Boolean} map Should include sourcemaps.
 * @property {Boolean} lint Should lint files before bundle.
 * @property {Boolean} lint-styles Should lint SASS files.
 * @property {Boolean} lint-js Should lint JavaScript files.
 * @property {Boolean} watch Should watch fils.
 * @property {Boolean} cache Use cache if available.
 */
module.exports = (app, options = {}) => {
    options = Proteins.clone(options);
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let lintTask = global.Promise.resolve();
    if (options.lint !== false) {
        lintTask = app.exec('lint', {
            arguments: typeof options.lint === 'string' ? [options.lint] : options.arguments,
            styles: options['lint-styles'] !== false,
            js: options['lint-js'] !== false,
            warnings: false,
        });
    }
    return lintTask.then(() => {
        let filter = optionsUtils.handleArguments(options);
        let promise = global.Promise.resolve();

        let bundleManifests = [];

        // Process packages.
        Object.values(filter.packages).forEach((pkg) => {
            promise = promise.then(() => {
                let json = pkg.json;
                if (!json.main && !options.output) {
                    app.log(colors.red(`Missing 'output' property for ${pkg.name} module.`));
                    return global.Promise.reject();
                }
                let opts = Proteins.clone(options);
                if (json.module) {
                    opts.input = path.join(pkg.path, json.module);
                    opts.output = path.join(pkg.path, json.main);
                } else {
                    opts.input = path.join(pkg.path, json.main);
                }
                return bundle(app, opts)
                    .then((manifest) => {
                        bundleManifests.push(manifest);
                        return global.Promise.resolve(manifest);
                    });
            });
        });

        // Process single files.
        filter.files.forEach((file) => {
            promise = promise.then(() => {
                let opts = Proteins.clone(options);
                opts.input = file;
                if (opts.output) {
                    if (filter.files.length > 1) {
                        opts.output = path.resolve(path.dirname(file), opts.output);
                    }
                }
                if (['.scss', '.sass'].indexOf(path.extname(file)) !== -1) {
                    // Style file
                    return sass(app, opts)
                        .then((manifest) => {
                            // collect the generated BundleManifest
                            bundleManifests.push(manifest);
                            return global.Promise.resolve(manifest);
                        });
                }
                // Javascript file
                return bundle(app, opts)
                    .then((manifest) => {
                        // collect the generated BundleManifest
                        bundleManifests.push(manifest);
                        return global.Promise.resolve(manifest);
                    });
            });
        });

        return promise
            .then(() => {
                // once bundles are generated, check for watch option.
                if (options.watch) {
                    // collect bundles dependencies.
                    let files = {};
                    // iterate BundleManifest instances.
                    bundleManifests.forEach((bundleManifest) => {
                        // iterate bundle dependencies.
                        bundleManifest.files.forEach((f) => {
                            // collect file manifest dependents.
                            files[f] = files[f] || [];
                            files[f].push(bundleManifest);
                        });
                    });
                    // start the watch task
                    watcher(app, Object.keys(files), (event, fp) => {
                        // find out manifests with changed file dependency.
                        let bundles = files[fp];
                        // setup a rebuild Promises chain.
                        let rebuildPromise = global.Promise.resolve();
                        bundles.forEach((bundle) => {
                            // exec build again using cache.
                            rebuildPromise = rebuildPromise.then(() => app.exec('build', {
                                'arguments': [bundle.input],
                                'output': bundle.output,
                                'lint': fp,
                                'lint-sass': options['lint-sass'],
                                'lint-js': options['lint-js'],
                                'cache': true,
                            }));
                        });
                    });
                }
                // resolve build task with the list of generated manifests.
                return global.Promise.resolve(bundleManifests);
            });
    });
};
