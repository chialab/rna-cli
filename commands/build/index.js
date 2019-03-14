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
        .option('--output <file>', 'The destination file.')
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
        .option('[--analyze <file>]', 'Save an analytic report for bundle size.')
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
                        // a javascript source has been detected.
                        const ScriptBundler = require('../../lib/Bundlers/ScriptBundler.js');

                        let moduleOutput = mainFile ? mainFile : output;
                        let bundler = new ScriptBundler(app, entry);
                        await bundler.setup({
                            input: moduleFile,
                            output: moduleOutput,
                            targets,
                            production: options.production,
                            map: options.map,
                            lint: options.lint,
                            analyze: options.analyze,
                        });
                        await bundler.build();
                        // collect the generated Bundle.
                        bundles.push(bundler);
                    }

                    if (styleFile) {
                        const StyleBundler = require('../../lib/Bundlers/StyleBundler.js');

                        let styleOutput = mainFile ?
                            mainFile.directory.file(mainFile.basename.replace(mainFile.extname, '.css')) :
                            output;
                        // a style source has been detected.
                        let bundler = new StyleBundler(app, entry);
                        await bundler.setup({
                            input: styleFile,
                            output: styleOutput,
                            targets,
                            production: options.production,
                            map: options.map,
                            lint: options.lint,
                        });
                        await bundler.build();
                        // collect the generated Bundle.
                        bundles.push(bundler);
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
                    const ScriptBundler = require('../../lib/Bundlers/ScriptBundler.js');

                    let bundler = new ScriptBundler(app, project);
                    await bundler.setup({
                        input: entry,
                        output,
                        targets,
                        production: options.production,
                        map: options.map,
                        lint: options.lint,
                        analyze: options.analyze,
                    });
                    await bundler.build();
                    // collect the generated Bundle
                    bundles.push(bundler);
                    continue;
                }

                if (isStyleFile(entry.path)) {
                    // Style file
                    const StyleBundler = require('../../lib/Bundlers/StyleBundler.js');

                    let bundler = new StyleBundler(app, project);
                    await bundler.setup({
                        input: entry,
                        output,
                        targets,
                        production: options.production,
                        map: options.map,
                        lint: options.lint,
                    });
                    await bundler.build();
                    // collect the generated Bundle
                    bundles.push(bundler);
                    continue;
                }

                if (entry.extname === '.html') {
                    const HTMLBundler = require('../../lib/Bundlers/HTMLBundler.js');
                    let bundler = new HTMLBundler(app, project);
                    await bundler.setup({
                        input: entry,
                        output,
                        targets,
                        production: options.production,
                        map: options.map,
                        lint: options.lint,
                    });
                    await bundler.build();
                    // collect the generated Bundle
                    bundles.push(bundler);
                    continue;
                }

                if (entry.extname === '.webmanifest') {
                    const WebManifest = require('../../lib/Bundlers/WebManifest.js');

                    let bundler = new WebManifest(app, project);
                    await bundler.setup({
                        input: entry,
                        output,
                    });
                    await bundler.build();
                    // collect the generated Bundle
                    bundles.push(bundler);
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

                watcher.on('change', (file) => {
                    let label = file.exists() ? 'changed' : 'removed';
                    app.logger.info(`${file.localPath} ${label}`);
                });

                await watcher.watch(async (file) => {
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
                                await bundle.build(file.path);
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

function filterChangedBundles(bundles, file) {
    return bundles
        .filter((bundle) => {
            let bundleFiles = bundle.files || [];
            return bundleFiles.includes(file);
        });
}
