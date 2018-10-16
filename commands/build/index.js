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
        .readme(`${__dirname}/README.md`)
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
        .option('[--polyfill]', 'Auto add polyfills. [experimental]')
        .option('[--optimize]', 'Run OptimizeJS after bundle. [experimental]')
        .action(async (app, options = {}) => {
            const path = require('path');
            const browserslist = require('browserslist');
            const Project = require('../../lib/Project');
            const Watcher = require('../../lib/Watcher');
            const { isJSFile, isStyleFile } = require('../../lib/extensions');
            const PriorityQueues = require('../../lib/PriorityQueues');

            const cwd = process.cwd();
            const project = new Project(cwd);

            if (options.production && !process.env.hasOwnProperty('NODE_ENV')) {
                // Set NODE_ENV environment variable if `--production` flag is set.
                app.logger.info('setting "production" environment');
                process.env.NODE_ENV = 'production';
            }

            let entries;
            let outputRelative = false;
            if (options.arguments.length) {
                outputRelative = options.arguments.length > 1 || options.arguments[0].includes('*');
                entries = project.resolve(options.arguments);
            } else {
                let workspaces = project.workspaces;
                if (workspaces) {
                    entries = workspaces;
                } else {
                    entries = [project];
                }
            }

            if (!entries.length) {
                throw 'missing files to build';
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
                        if (outputRelative) {
                            output = moduleFile.directory.file(options.output);
                        }  else if (path.extname(options.output)) {
                            output = project.file(options.output);
                        } else if (mainFile) {
                            output = mainFile;
                        } else {
                            output = project.directory(options.output);
                        }
                    } else if (directories.public || directories.lib) {
                        output = directories.public || directories.lib;
                    } else if (mainFile) {
                        output = project.directory(mainFile.dirname);
                    } else {
                        throw 'missing `output` option';
                    }

                    if (moduleFile) {
                        let moduleOutput = mainFile ? mainFile : output;
                        // a javascript source has been detected.
                        let manifest = await rollup(app, entry, {
                            input: moduleFile,
                            output: moduleOutput,
                            targets,
                            production: options.production,
                            map: options.map,
                            lint: options.lint,
                        });
                        // collect the generated Bundle.
                        bundles.push(manifest);
                    }

                    if (styleFile) {
                        let styleOutput = mainFile ?
                            mainFile.directory.file(mainFile.basename.replace(mainFile.extname, '.css')) :
                            output;
                        // a style source has been detected.
                        let manifest = await postcss(app, entry, {
                            input: styleFile,
                            output: styleOutput,
                            targets,
                            production: options.production,
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
                    if (outputRelative) {
                        output = entry.directory.file(options.output);
                    } else if (path.extname(options.output)) {
                        output = project.file(options.output);
                    } else {
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
                        production: options.production,
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
                        production: options.production,
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
                let watcher = new Watcher(project, {
                    ignore: (file) => !filterChangedBundles(bundles, file).length,
                });

                watcher.on('change', (event, file) => {
                    let label;
                    switch (event) {
                        case 'add':
                            label = 'created';
                            break;
                        case 'unlink':
                            label = 'removed';
                            break;
                        default:
                            label = 'changed';
                    }
                    app.logger.info(`${file.localPath} ${label}`);
                });

                await watcher.watch(async (event, file) => {
                    let promise = Promise.resolve();
                    let bundlesWithChanges = filterChangedBundles(bundles, file.path);

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
                                    app.logger.error(err);
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

async function rollup(app, project, options, bundle = {}) {
    const Rollup = require('../../lib/Bundlers/Rollup.js');
    const profile = app.profiler.task('rollup');

    try {
        let input = options.input;
        let output = options.output;
        if (!output.extname) {
            output = output.file(input.basename.replace(input.extname, '.js'));
        }

        if (output.mapFile.exists()) {
            output.mapFile.unlink();
        }

        app.logger.play(`bundling${bundle.config ? ' (this will be fast)...' : '...'}`, input.localPath);

        if (!bundle.config && project) {
            bundle.config = Rollup.detectConfig(app, project, {
                cacheRoot: app.store.tmpdir('rollup'),
                input: input.path,
                output: output.path,
                production: options.production,
                map: options.map,
                lint: options.lint,
                targets: options.targets,
            });
        }

        let rollupBundle = new Rollup(bundle.config);
        rollupBundle.on('warning', (warning) => {
            let message = warning && warning.message || warning;
            message = message.toString();
            if (message.indexOf('The \'this\' keyword') !== -1) {
                return false;
            }
            if (message.indexOf('rollupPluginBabelHelper') !== -1) {
                return false;
            }
            app.logger.warn(message);
        });
        await rollupBundle.build();
        await rollupBundle.write();
        if (app.options.profile) {
            let tasks = rollupBundle.timings;
            for (let k in tasks) {
                profile.task(k, false).set(tasks[k]);
            }
        }

        profile.end();
        app.logger.stop();

        let { size, zipped } = output.size;
        app.logger.success('bundle ready');
        app.logger.info(output.localPath, `${size}, ${zipped} zipped`);

        if (rollupBundle.linter && (rollupBundle.linter.hasErrors() || rollupBundle.linter.hasWarnings())) {
            app.logger.log(rollupBundle.linter.report());
        }

        bundle.files = rollupBundle.files;

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
        app.logger.stop();
        profile.end();
        throw err;
    }
}

async function postcss(app, project, options, bundle = {}) {
    const PostCSS = require('../../lib/Bundlers/PostCSS.js');
    const profile = app.profiler.task('postcss');

    try {
        let input = options.input;
        let output = options.output;
        if (!output.extname) {
            output = output.file(input.basename.replace(input.extname, '.css'));
        }

        if (output.mapFile.exists()) {
            output.mapFile.unlink();
        }

        if (!bundle.config) {
            bundle.config = PostCSS.detectConfig(app, project, {
                input: input.path,
                output: output.path,
                production: options.production,
                map: options.map,
                lint: options.lint,
                targets: options.targets,
            });
        }
        app.logger.play('postcss...', input.localPath);

        let postCSSBundle = new PostCSS(bundle.config);
        await postCSSBundle.build();
        await postCSSBundle.write();

        app.logger.stop();
        profile.end();

        let { size, zipped } = output.size;
        app.logger.success('css ready');
        app.logger.info(output.localPath, `${size}, ${zipped} zipped`);

        if (postCSSBundle.linter && (postCSSBundle.linter.hasErrors() || postCSSBundle.linter.hasWarnings())) {
            app.logger.log(postCSSBundle.linter.report());
        }

        bundle.files = postCSSBundle.files;

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
        app.logger.stop();
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
