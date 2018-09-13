const fs = require('fs-extra');
const path = require('path');
const Proteins = require('@chialab/proteins');
const paths = require('../../lib/paths.js');
const Entry = require('../../lib/entry.js');
const bundle = require('./bundlers/rollup.js');
const sass = require('./bundlers/sass.js');
const Watcher = require('../../lib/Watcher');
const ext = require('../../lib/extensions.js');
const browserslist = require('../../lib/browserslist.js');
const PriorityQueues = require('../../lib/PriorityQueues');
const Queue = require('../../lib/Queue');

/**
 * Add bundles' files to the watcher.
 * @param {Object} files Set of data where keys are file paths and values a list of related bundles.
 * @param {Watcher} watcher The watcher instance.
 * @param {BundleManifest} bundleManifest A bundle.
 * @param {BundleManifest} oldManifest The previous bundle.
 */
function watchBundle(files, watcher, bundleManifest, oldManifest) {
    if (oldManifest) {
        // remove old manifest from the list.
        oldManifest.files.forEach((f) => {
            const list = files[f] || [];
            const io = list.indexOf(oldManifest);
            if (io !== -1) {
                list.splice(io, 1);
            }
        });
    }
    // iterate bundle dependencies.
    bundleManifest.files.forEach((f) => {
        // collect file manifest dependents.
        files[f] = files[f] || [];
        files[f].push(bundleManifest);
        watcher.add(f);
    });
}

/**
 * Command action to build sources.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @param {Profiler} profiler The command profiler instance.
 * @returns {Promise}
 *
 * @namespace options
 * @property {Boolean} production Should bundle files for production.
 * @property {Boolean} map Should include sourcemaps.
 * @property {Boolean} lint Should lint files before bundle.
 * @property {Boolean} lint-styles Should lint SASS files.
 * @property {Boolean} lint-js Should lint JavaScript files.
 * @property {Boolean} watch Should watch files.
 * @property {Boolean} cache Use cache if available.
 */
module.exports = async(app, options = {}, profiler) => {
    options = Proteins.clone(options);
    if (!options.arguments.length && !paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }

    let entries = Entry.resolve(paths.cwd, options.arguments);
    let bundleManifests = [];

    // Process entries.
    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];

        if (entry.file) {
            let opts = Proteins.clone(options);
            opts.input = entry.file.path;
            if (opts.output) {
                if (entries.length > 1) {
                    opts.output = path.resolve(path.dirname(entry.file.path), opts.output);
                }
            }
            opts.targets = opts.targets ? browserslist.elaborate(opts.targets) : browserslist.load(opts.input);
            if (ext.isStyleFile(entry.file.path)) {
                // Style file
                let manifest = await sass(app, opts, profiler);
                // collect the generated BundleManifest
                bundleManifests.push(manifest);
                continue;
            }
            try {
                // Javascript file
                let manifest = await bundle(app, opts, profiler);
                // collect the generated BundleManifest
                bundleManifests.push(manifest);
            } catch (err) {
                if (err.plugin && err.plugin === 'eslint') {
                    throw '';
                }
                throw err;
            }
            continue;
        }

        let json = entry.package.json;

        // if package has not main field and options output is missing
        // the cli cannot detect where to build the files.
        if (!json.main && !options.output) {
            throw `Missing 'output' property for ${entry.package.name} module.`;
        }

        // build `modules` > `main`.js
        // clone options in order to use for js bundler.
        let jsOptions = Proteins.clone(options);
        if (json.module && ext.isJSFile(json.module)) {
            // if module field is a javascript file, use it as source file.
            jsOptions.input = path.join(entry.package.path, json.module);
            // if the output option is missing, use the main field.
            let stat = fs.existsSync(json.main) && fs.statSync(json.main);
            let distPath = stat && stat.isDirectory() ?
                path.join(entry.package.path, json.main, path.basename(jsOptions.input)) :
                path.join(entry.package.path, json.main);
            jsOptions.output = jsOptions.output || distPath;
        } else if (jsOptions.output && ext.isJSFile(json.main)) {
            // if output option is different from the main field
            // we can use the main file as source if it is javascript.
            jsOptions.input = path.join(entry.package.path, json.main);
        }
        if (jsOptions.input) {
            jsOptions.targets = options.targets ? browserslist.elaborate(options.targets) : browserslist.load(json);
            // a javascript source has been detected.
            try {
                let manifest = await bundle(app, jsOptions, profiler);
                bundleManifests.push(manifest);
            } catch (err) {
                if (err.plugin && err.plugin === 'eslint') {
                    throw '';
                }
                throw err;
            }
        }

        // build `style` > `main`.css
        // clone options in order to use for sass bundler.
        let styleOptions = Proteins.clone(options);
        if (json.style && ext.isStyleFile(json.style)) {
            // if style field is a style file, use it as source file.
            styleOptions.input = path.join(entry.package.path, json.style);
            // if the output option is missing, use the main field.
            let stat = fs.existsSync(json.main) && fs.statSync(json.main);
            let distPath = stat && stat.isDirectory() ?
                path.join(entry.package.path, json.main, path.basename(jsOptions.input)) :
                path.join(entry.package.path, json.main);
            styleOptions.output = styleOptions.output || distPath;
            // ensure output style file.
            if (!ext.isStyleFile(styleOptions.output)) {
                styleOptions.output = path.join(
                    path.dirname(styleOptions.output),
                    `${path.basename(styleOptions.output, path.extname(styleOptions.output))}.css`
                );
            }
        } else if (styleOptions.output && ext.isStyleFile(json.main)) {
            // if output option is different from the main field
            // we can use the main file as source if it is a style.
            styleOptions.input = path.join(entry.package.path, json.main);
        }
        if (styleOptions.input) {
            styleOptions.targets = options.targets ? browserslist.elaborate(options.targets) : browserslist.load(json);
            // a style source has been detected.
            let manifest = await sass(app, styleOptions, profiler);
            // collect the generated BundleManifest
            bundleManifests.push(manifest);
        }
    }

    // once bundles are generated, check for watch option.
    if (options.watch) {
        // setup a bundles priority chain.
        const BUNDLES_QUEUES = new PriorityQueues();
        // setup a rebuild Promises chain.
        const REBUILD_QUEUE = new Queue();
        // start the watch task
        const WATCHER = new Watcher({
            cwd: paths.cwd,
            log: true,
        });
        // collect bundles dependencies.
        const FILES = {};
        bundleManifests.forEach((bundle) => {
            watchBundle(FILES, WATCHER, bundle);
        });
        await WATCHER.watch((event, fp) => {
            REBUILD_QUEUE.add(() =>
                Promise.all(
                    // find out manifests with changed file dependency.
                    FILES[fp].map(async(bundle) => {
                        try {
                            await BUNDLES_QUEUES.tick(bundle, 100);
                            let bundleManifests = await app.exec('build', Object.assign(options, {
                                arguments: [bundle.input],
                                output: bundle.output,
                                cache: true,
                                watch: false,
                            }));
                            // watch new files for bundles.
                            await watchBundle(FILES, WATCHER, bundleManifests[0], bundle);
                        } catch (err) {
                            if (err) {
                                app.log(err);
                            }
                        }
                    })
                )
            );
        });
    }
    // resolve build task with the list of generated manifests.
    return bundleManifests;
};
