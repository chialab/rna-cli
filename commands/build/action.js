const fs = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const paths = require('../../lib/paths.js');
const Entry = require('../../lib/entry.js');
const Watcher = require('../../lib/Watcher');
const ext = require('../../lib/extensions.js');
const browserslist = require('../../lib/browserslist.js');
const PriorityQueues = require('../../lib/PriorityQueues');
const utils = require('../../lib/utils.js');
const fileSize = require('../../lib/file-size.js');

async function rollup(app, options, profiler) {
    const Rollup = require('../../lib/Bundlers/Rollup.js');

    if (options.output) {
        options.output = path.resolve(paths.cwd, options.output);
        let final = options.output.split(path.sep).pop();
        if (!final.match(/\./)) {
            options.output = path.join(
                options.output,
                path.basename(options.input)
            );
        }
    }

    if (!options.name) {
        options.name = utils.camelize(
            path.basename(options.output, path.extname(options.output))
        );
    }

    if (options.production && !process.env.hasOwnProperty('NODE_ENV')) {
        // Set NODE_ENV environment variable if `--production` flag is set.
        app.log(colors.yellow('🚢  setting "production" environment.'));
        process.env.NODE_ENV = 'production';
    }

    if (fs.existsSync(`${options.output}.map`)) {
        fs.unlinkSync(`${options.output}.map`);
    }

    let profile = profiler.task('rollup');
    let task = app.log(`bundling... ${colors.grey(`(${path.relative(paths.cwd, options.input)})`)}`, true);
    try {
        let config = await Rollup.detectConfig();
        let bundler = new Rollup(
            Object.assign({
                config,
            }, options)
        );
        let manifest = await bundler.build();
        if (app.options.profile) {
            let tasks = bundler.timings();
            for (let k in tasks) {
                profile.task(k, false).set(tasks[k]);
            }
        }
        profile.end();
        task();
        app.log(colors.bold(colors.green('bundle ready!')));
        app.log(fileSize(options.output));

        if (bundler.linter && (bundler.linter.hasErrors() || bundler.linter.hasWarnings())) {
            app.log(bundler.linter.report());
        }

        return manifest;
    } catch (err) {
        profile.end();
        task();
        throw err;
    }
}

async function postcss(app, options, profiler) {
    const PostCSS = require('../../lib/Bundlers/PostCSS.js');

    if (options.output) {
        options.output = path.resolve(paths.cwd, options.output);
        let final = options.output.split(path.sep).pop();
        if (!final.match(/\./)) {
            options.output = path.join(
                options.output,
                path.basename(options.input)
            );
        }
    }

    if (fs.existsSync(`${options.output}.map`)) {
        fs.unlinkSync(`${options.output}.map`);
    }

    let task = app.log(`postcss... ${colors.grey(`(${path.relative(paths.cwd, options.input)})`)}`, true);
    let profile = profiler.task('postcss');
    try {
        let bundler = new PostCSS(options);
        let manifest = await bundler.build();
        task();
        profile.end();
        app.log(colors.bold(colors.green('css ready!')));
        app.log(fileSize(options.output));

        if (bundler.linter && (bundler.linter.hasErrors() || bundler.linter.hasWarnings())) {
            app.log(bundler.linter.report());
        }

        return manifest;
    } catch (err) {
        task();
        profile.end();
        throw err;
    }
}

function changedBundles(bundles, file) {
    return bundles
        .filter((bundle) => {
            let bundleFiles = bundle.files || [];
            return bundleFiles.includes(file);
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
module.exports = async function build(app, options = {}, profiler) {
    options = Proteins.clone(options);
    if (!options.arguments.length && !paths.cwd) {
        // Unable to detect project root.
        throw 'No project found.';
    }

    let entries = Entry.resolve(paths.cwd, options.arguments);
    let bundles = [];

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
                let manifest = await postcss(app, opts, profiler);
                // collect the generated Bundle
                bundles.push(manifest);
                continue;
            }
            // Javascript file
            let manifest = await rollup(app, opts, profiler);
            // collect the generated Bundle
            bundles.push(manifest);
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
            let manifest = await rollup(app, jsOptions, profiler);
            bundles.push(manifest);
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
            let manifest = await postcss(app, styleOptions, profiler);
            // collect the generated Bundle
            bundles.push(manifest);
        }
    }

    // once bundles are generated, check for watch option.
    if (options.watch) {
        // setup a bundles priority chain.
        let queue = new PriorityQueues();
        // start the watch task
        let watcher = new Watcher(paths.cwd, {
            log: true,
            ignore: (file) => !changedBundles(bundles, file).length,
        });

        watcher.watch(async (event, file) => {
            let promise = Promise.resolve();
            let bundlesWithChanges = changedBundles(bundles, file);

            if (bundlesWithChanges.length === 0) {
                return true;
            }

            let ticks = await Promise.all(
                // find out manifests with changed file dependency.
                bundlesWithChanges.map((bundle) => queue.tick(bundle, 100))
            );

            for (let i = 0; i < ticks.length; i++) {
                if (!ticks[i]) {
                    continue;
                }

                let bundle = bundlesWithChanges[i];
                promise = promise.then(async () => {
                    try {
                        await build(app, Object.assign(options, {
                            arguments: [bundle.input],
                            output: bundle.output,
                            cache: true,
                            watch: false,
                        }), profiler);
                    } catch (err) {
                        if (err) {
                            app.log(err);
                        }
                    }
                });
            }

            await promise;
        });
    }
    // resolve build task with the list of generated manifests.
    return bundles;
};
