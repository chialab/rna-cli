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
        .option('[--analyze <file>]', 'Save an analytic report for bundle size.')
        .action(async (app, options = {}) => {
            const path = require('path');
            const browserslist = require('browserslist');
            const Project = require('../../lib/Project');
            const Watcher = require('../../lib/Watcher');
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
                    const moduleFile = entry.get('module') && entry.file(entry.get('module'));
                    const libFile = entry.get('lib') && entry.file(entry.get('lib'));
                    const mainFile = entry.get('main') && entry.file(entry.get('main'));
                    const styleFile = entry.get('style') && entry.file(entry.get('style'));
                    const typingsFile = entry.get('types') && entry.file(entry.get('types'));

                    const targets = options.targets ? browserslist(options.targets) : entry.browserslist;

                    let output;
                    if (options.output) {
                        if (outputRelative) {
                            output = (libFile || moduleFile).parent.file(options.output);
                        } else if (path.extname(options.output)) {
                            output = project.file(options.output);
                        } else if (mainFile) {
                            output = mainFile;
                        } else {
                            output = project.directory(options.output);
                        }
                    }

                    if (libFile) {
                        if (output) {
                            let bundler = await buildEntry(app, entry, libFile, output, Object.assign({}, options, { targets, typings: /.d.ts$/.test(output.path) }));
                            if (bundler) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        } else {
                            if (mainFile) {
                                let bundler = await buildEntry(app, entry, libFile, mainFile, Object.assign({}, options, { targets, format: 'umd' }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                            if (moduleFile) {
                                let bundler = await buildEntry(app, entry, libFile, moduleFile, Object.assign({}, options, { targets: 'esmodules', format: 'esm', lint: !mainFile && options.lint }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                            if (typingsFile) {
                                let bundler = await buildEntry(app, entry, libFile, typingsFile, Object.assign({}, options, { typings: true, format: 'esm', map: false }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                        }
                    } else {
                        if (!output && mainFile) {
                            output = project.directory(mainFile.dirname);
                        } else {
                            throw 'missing `output` option';
                        }
                        // retrocompatibility with RNA 2.0

                        if (moduleFile) {
                            let moduleOutput = mainFile ? mainFile : output;
                            let bundler = await buildEntry(app, entry, moduleFile, moduleOutput, Object.assign({}, options, { targets }));
                            if (bundler) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        }

                        if (styleFile) {
                            let styleOutput = mainFile ?
                                mainFile.parent.file(mainFile.basename.replace(mainFile.extname, '.css')) :
                                output;

                            let bundler = await buildEntry(app, entry, styleFile, styleOutput, Object.assign({}, options, { targets }));
                            if (bundler) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        }
                    }
                } else {
                    let output;
                    if (options.output) {
                        if (outputRelative) {
                            output = entry.parent.file(options.output);
                        } else if (path.extname(options.output)) {
                            output = project.file(options.output);
                        } else {
                            output = project.directory(options.output);
                        }
                    } else {
                        throw 'missing `output` option';
                    }

                    const targets = options.targets ? browserslist(options.targets) : project.browserslist;

                    let bundler = await buildEntry(app, project, entry, output, Object.assign({}, options, { targets, typings: /.d.ts$/.test(output.path) }));
                    if (bundler) {
                        // collect the generated Bundle.
                        bundles.push(bundler);
                    }
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
                                await bundle.write();
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

async function buildEntry(app, project, entry, output, options) {
    const { isJSFile, isStyleFile, isHTMLFile, isWebManifestFile } = require('../../lib/extensions');

    if (isJSFile(entry.path)) {
        // Javascript file
        const ScriptBundler = require('../../lib/Bundlers/ScriptBundler.js');

        let bundler = new ScriptBundler(app, project);
        await bundler.setup({
            input: entry,
            output,
            name: options.name,
            targets: options.targets,
            production: options.production,
            map: options.map,
            lint: options.lint,
            analyze: options.analyze,
            polyfill: options.polyfill,
            typings: options.typings,
        });
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    } else if (isStyleFile(entry.path)) {
        // Style file
        const StyleBundler = require('../../lib/Bundlers/StyleBundler.js');

        let bundler = new StyleBundler(app, project);
        await bundler.setup({
            input: entry,
            output,
            targets: options.targets,
            production: options.production,
            map: options.map,
            lint: options.lint,
        });
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    } else if (isHTMLFile(entry.path)) {
        const HTMLBundler = require('../../lib/Bundlers/HTMLBundler.js');
        let bundler = new HTMLBundler(app, project);
        await bundler.setup({
            input: entry,
            output,
            targets: options.targets,
            production: options.production,
            map: options.map,
            lint: options.lint,
            polyfill: options.polyfill,
        });
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    } else if (isWebManifestFile(entry.path)) {
        const WebManifestBundler = require('../../lib/Bundlers/WebManifestBundler.js');

        let bundler = new WebManifestBundler(app, project);
        await bundler.setup({
            input: entry,
            output,
        });
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    }
}

function filterChangedBundles(bundles, file) {
    return bundles
        .filter((bundle) => {
            let bundleFiles = bundle.files || [];
            return bundleFiles.includes(file);
        });
}
