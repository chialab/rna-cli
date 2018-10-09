/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('build')
        .description('Build the project.')
        .help(`It uses \`rollup\` (https://rollupjs.org/) to bundle the source code.
It handles multiple sources:

 * JS and JSX (transpiled with Babel)
 * css/sass/scss (with dart-sass)
 * json
 * binary files as blob urls
 * other JS modules (ES6, commonjs)

It also produce sourcemaps and uglify the code in production mode.

A default configuration is also provided.
Anyway, the developer can use a custom configuration if the \`rollup.config.js\` file exists in the root of the project.
It supports \`.babelrc\` too, to replace the default babel configuration.`)
        .option('<file>', 'The file to build.')
        .option('<package1> <package2> <package3>', 'The packages to build.')
        .option('--output', 'The destination file.')
        .option('[--targets]', 'A supported browserslist query. Use --no-targets to transpile only non-standard features.')
        .option('[--name]', 'The bundle name.')
        .option('[--format]', 'The bundle format (es, umd, iife, cjs).')
        .option('[--production]', 'Minify bundle.')
        .option('[--declaration]', 'Generate typescript declarations.')
        .option('[--watch]', 'Watch sources and rebuild on files changes.')
        .option('[--no-map]', 'Do not produce source map.')
        .option('[--no-lint]', 'Do not lint files before bundle.')
        .option('[--jsx.pragma]', 'The JSX pragma to use.')
        .option('[--jsx.module]', 'The module to auto import for JSX pragma.')
        .option('[--polyfill]', 'Auto add polyfills. [⚠️  experimental]')
        .option('[--optimize]', 'Run OptimizeJS after bundle. [⚠️  experimental]')
        .action(async (app, options = {}) => {
            const colors = require('colors/safe');
            const browserslist = require('browserslist');
            const Project = require('../../lib/Project');
            const Watcher = require('../../lib/Watcher');
            const { isJSFile, isStyleFile } = require('../../lib/extensions');
            const PriorityQueues = require('../../lib/PriorityQueues');

            const cwd = process.cwd();
            const project = new Project(cwd);

            if (options.production && !process.env.hasOwnProperty('NODE_ENV')) {
                // Set NODE_ENV environment variable if `--production` flag is set.
                app.log(colors.yellow('🚢  setting "production" environment.'));
                process.env.NODE_ENV = 'production';
            }

            let entries;
            if (options.arguments.length) {
                entries = project.resolve(options.arguments);
            } else {
                let workspaces = project.workspaces;
                if (workspaces) {
                    entries = workspaces;
                } else {
                    entries = [project];
                }
            }

            let bundles = [];

            // Process entries.
            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];

                if (entry instanceof Project) {
                    const directories = entry.directories;
                    const moduleFile = entry.get('module') && entry.file(entry.get('module'));
                    const mainFile = entry.get('main') && entry.file(entry.get('main'));
                    const styleFile = entry.get('style') && entry.file(entry.get('style'));

                    const targets = options.targets ? browserslist(options.targets) : project.browserslist;

                    let output;
                    if (options.output) {
                        output = project.file(options.output);
                        if (!output.extname) {
                            if (mainFile) {
                                output = mainFile;
                            } else {
                                output = project.directory(options.output);
                            }
                        }
                    } else if (directories.public || directories.lib) {
                        output = directories.public || directories.lib;
                    } else if (mainFile) {
                        output = project.directory(mainFile.dirname);
                    } else {
                        throw 'missing `output` option';
                    }

                    if (moduleFile) {
                        // a javascript source has been detected.
                        let manifest = await rollup(app, entry, {
                            input: moduleFile,
                            output,
                            targets,
                            production: options.lint,
                            map: options.map,
                            lint: options.lint,
                        });
                        // collect the generated Bundle.
                        bundles.push(manifest);
                    }

                    if (styleFile) {
                        // a style source has been detected.
                        let manifest = await postcss(app, entry, {
                            input: styleFile,
                            output,
                            targets,
                            production: options.lint,
                            map: options.map,
                            lint: options.lint,
                        });
                        // collect the generated Bundle.
                        bundles.push(manifest);
                    }
                    continue;
                }

                let output;
                if (options.output) {
                    output = project.file(options.output);
                    if (!output.extname) {
                        output = project.directory(options.output);
                    }
                } else {
                    throw 'missing `output` option';
                }

                const targets = options.targets ? browserslist(options.targets) : project.browserslist;

                if (isJSFile(entry.path)) {
                    // Javascript file
                    let manifest = await rollup(app, project, {
                        input: entry,
                        output,
                        targets,
                        production: options.lint,
                        map: options.map,
                        lint: options.lint,
                    });
                    // collect the generated Bundle
                    bundles.push(manifest);
                    continue;
                }

                if (isStyleFile(entry.path)) {
                    // Style file
                    let manifest = await postcss(app, project, {
                        input: entry,
                        output,
                        targets,
                        production: options.lint,
                        map: options.map,
                        lint: options.lint,
                    });
                    // collect the generated Bundle
                    bundles.push(manifest);
                    continue;
                }
            }

            // once bundles are generated, check for watch option.
            if (options.watch) {
                // setup a bundles priority chain.
                let queue = new PriorityQueues();
                // start the watch task
                let watcher = new Watcher(cwd, {
                    log: true,
                    ignore: (file) => !filterChangedBundles(bundles, file).length,
                });

                watcher.watch(async (event, file) => {
                    let promise = Promise.resolve();
                    let bundlesWithChanges = filterChangedBundles(bundles, file);

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
                                await bundle.rebuild();
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
        });
};

async function rollup(app, project, options, previousBundle) {
    const colors = require('colors/safe');
    const Rollup = require('../../lib/Bundlers/Rollup.js');

    let profile = app.profiler.task('rollup');
    let task;
    try {
        let bundle = previousBundle;
        let input = options.input;
        let output = options.output;
        if (output.exists() && output.isDirectory()) {
            output = output.file(input.basename.replace(input.extname, '.js'));
        }

        if (output.mapFile.exists()) {
            output.mapFile.unlink();
        }

        if (!bundle && project) {
            let config = Rollup.detectConfig(app, project, {
                cacheRoot: app.store.tmpdir('rollup'),
                input: input.path,
                output: output.path,
                production: options.production,
                map: options.map,
                lint: options.lint,
                targets: options.targets,
            });
            bundle = new Rollup(config);
        }
        task = app.log(`bundling... ${colors.grey(`(${input.localPath})`)}`, true);
        await bundle.build();
        await bundle.write();
        if (app.options.profile) {
            let tasks = bundle.timings;
            for (let k in tasks) {
                profile.task(k, false).set(tasks[k]);
            }
        }
        profile.end();
        task();

        let { size, zipped } = output.size;
        app.log(colors.bold(colors.green('bundle ready!')));
        app.log(`${output.localPath} ${colors.grey(`(${size}, ${zipped} zipped)`)}`);

        if (bundle.linter && (bundle.linter.hasErrors() || bundle.linter.hasWarnings())) {
            app.log(bundle.linter.report());
        }

        bundle.rebuild = async function() {
            return await rollup(app, project, options, bundle);
        };

        try {
            global.gc();
        } catch (err) {
            //
        }

        return bundle;
    } catch (err) {
        if (task) {
            task();
        }
        profile.end();
        throw err;
    }
}

async function postcss(app, project, options, previousBundle) {
    const colors = require('colors/safe');
    const PostCSS = require('../../lib/Bundlers/PostCSS.js');

    let profile = app.profiler.task('postcss');
    let task;
    try {
        let bundle = previousBundle;
        let input = options.input;
        let output = options.output;
        if (output.exists() && output.isDirectory()) {
            output = output.file(input.basename.replace(input.extname, '.css'));
        }

        if (output.mapFile.exists()) {
            output.mapFile.unlink();
        }

        if (!bundle) {
            let config = PostCSS.detectConfig(app, project, {
                input: input.path,
                output: output.path,
                production: options.production,
                map: options.map,
                lint: options.lint,
                targets: options.targets,
            });
            bundle = new PostCSS(config);
        }
        task = app.log(`postcss... ${colors.grey(`(${input.localPath})`)}`, true);

        await bundle.build();
        await bundle.write();

        task();
        profile.end();

        let { size, zipped } = output.size;
        app.log(colors.bold(colors.green('css ready!')));
        app.log(`${output.localPath} ${colors.grey(`(${size}, ${zipped} zipped)`)}`);

        if (bundle.linter && (bundle.linter.hasErrors() || bundle.linter.hasWarnings())) {
            app.log(bundle.linter.report());
        }

        bundle.rebuild = async function() {
            return await postcss(app, project, options, bundle);
        };

        try {
            global.gc();
        } catch (err) {
            //
        }

        return bundle;
    } catch (err) {
        if (task) {
            task();
        }
        profile.end();
        throw err;
    }
}

function filterChangedBundles(bundles, file) {
    return bundles
        .filter((bundle) => {
            let bundleFiles = bundle.files || [];
            return bundleFiles.includes(file);
        });
}
