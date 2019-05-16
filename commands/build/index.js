const Linter = require('../../lib/Linters/Linter');
const ScriptBundler = require('../../lib/Bundlers/ScriptBundler');
const StyleBundler = require('../../lib/Bundlers/StyleBundler');
const HTMLBundler = require('../../lib/Bundlers/HTMLBundler');
const WebManifestBundler = require('../../lib/Bundlers/WebManifestBundler');

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
        .option('[--name]', 'The script name.')
        .option('[--format]', 'The script format (es, umd, iife, cjs).')
        .option('[--bundle]', 'Should bundle dependencies along the source files.')
        .option('[--production]', 'Minify script.')
        .option('[--declaration]', 'Generate typescript declarations.')
        .option('[--watch]', 'Watch sources and rebuild on files changes.')
        .option('[--no-map]', 'Do not produce source map.')
        .option('[--no-lint]', 'Do not lint files before build.')
        .option('[--jsx.pragma]', 'The JSX pragma to use.')
        .option('[--jsx.pragmaFrag]', 'The JSX pragma fragment to use.')
        .option('[--jsx.module]', 'The module to auto import for JSX pragma.')
        .option('[--typings [file]', 'Generate typescript declarations.')
        .option('[--analyze <file>]', 'Save an analytic report for script size.')
        .action(async (app, options = {}) => {
            const path = require('path');
            const browserslist = require('browserslist');
            const { Project } = require('../../lib/File');
            const Watcher = require('../../lib/Watcher');

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
                throw new Error('missing files to build');
            }

            let bundles = [];

            // Process entries.
            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];

                if (entry instanceof Project) {
                    const libFile = entry.get('lib') && entry.file(entry.get('lib'));
                    const moduleFile = entry.get('module') && entry.file(entry.get('module'));
                    const mainFile = entry.get('main') && entry.file(entry.get('main'));
                    const browserFile = entry.get('browser') && entry.file(entry.get('browser'));
                    const styleFile = entry.get('style') && entry.file(entry.get('style'));
                    let typingsFile;
                    if (typeof options.typings === 'string') {
                        typingsFile = entry.file(options.typings);
                    } else if (options.typings) {
                        if (entry.get('types')) {
                            typingsFile = entry.file(entry.get('types'));
                        }
                    }

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
                            let bundler = await buildEntry(app, entry, libFile, output, Object.assign({}, options, { targets, typings: typingsFile || !!options.typings }));
                            if (bundler) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        } else {
                            if (mainFile) {
                                let bundler = await buildEntry(app, entry, libFile, mainFile, Object.assign({}, options, { targets, format: 'cjs', typings: typingsFile || !!options.typings }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                            if (moduleFile) {
                                let bundler = await buildEntry(app, entry, libFile, moduleFile, Object.assign({}, options, { targets: 'esmodules', format: 'esm', lint: !mainFile && options.lint, typings: !mainFile && (typingsFile || !!options.typings) }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                            if (browserFile) {
                                let bundler = await buildEntry(app, entry, libFile, browserFile, Object.assign({}, options, { targets, format: 'umd', typings: typingsFile || !!options.typings }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                            if (!mainFile && !moduleFile && !browserFile && entry.directories.public) {
                                // maybe a web app?
                                let bundler = await buildEntry(app, entry, libFile, entry.directories.public, Object.assign({}, options, { targets }));
                                if (bundler) {
                                    // collect the generated Bundle.
                                    bundles.push(bundler);
                                }
                            }
                        }
                    } else if (moduleFile || styleFile) {
                        if (!output && mainFile) {
                            output = project.directory(mainFile.dirname);
                        } else {
                            throw new Error('missing `output` option');
                        }
                        // retrocompatibility with RNA 2.0

                        if (moduleFile) {
                            let moduleOutput = mainFile ? mainFile : output;
                            let bundler = await buildEntry(app, entry, moduleFile, moduleOutput, Object.assign({ bundle: true }, options, { targets }));
                            if (bundler) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        }

                        if (styleFile) {
                            let styleOutput = mainFile ?
                                mainFile.parent.file(`${mainFile.basename}.css`) :
                                output;

                            let bundler = await buildEntry(app, entry, styleFile, styleOutput, Object.assign({}, options, { targets }));
                            if (bundler) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        }
                    } else {
                        throw new Error('missing source file to build');
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
                        throw new Error('missing `output` option');
                    }

                    const targets = options.targets ? browserslist(options.targets) : project.browserslist;
                    let typingsFile;
                    if (typeof options.typings === 'string') {
                        typingsFile = project.file(options.typings);
                    } else if (options.typings) {
                        if (entry.get('types')) {
                            typingsFile = project.file(entry.get('types'));
                        }
                    }

                    let bundler = await buildEntry(app, project, entry, output, Object.assign({}, options, { targets, typings: typingsFile || !!options.typings }));
                    if (bundler) {
                        // collect the generated Bundle.
                        bundles.push(bundler);
                    }
                }
            }

            // once bundles are generated, check for watch option.
            if (options.watch) {
                // setup a bundles priority chain.
                const PriorityQueues = require('../../lib/PriorityQueues');
                const queue = new PriorityQueues();
                // start the watch task
                const watcher = new Watcher(project, {
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

function filterChangedBundles(bundles, file) {
    return bundles
        .filter((bundle) => {
            let bundleFiles = bundle.files || [];
            return bundleFiles.includes(file);
        });
}

async function buildEntry(app, project, entry, output, options) {
    const { isJSFile, isStyleFile, isHTMLFile, isWebManifestFile } = require('../../lib/extensions');

    function logFile(output) {
        if (output) {
            let { size, zipped } = output.size;
            app.logger.info(output.localPath, `${size}, ${zipped} zipped`);
        }
    }

    if (isJSFile(entry.path)) {
        // Javascript file
        let bundler = new ScriptBundler();
        let analysis;
        let linterResult;
        bundler.on(ScriptBundler.START_EVENT, (input, code, invalidate, child) => {
            if (!child) {
                app.logger.play(`generating script${invalidate.length ? ' (this will be fast)...' : '...'}`, code ? '' : input.localPath);
            }
        });
        bundler.on(ScriptBundler.END_EVENT, (child) => {
            if (!child) {
                app.logger.stop();
                if (linterResult) {
                    app.logger.log(linterResult);
                }
                if (analysis) {
                    app.logger.info(analysis);
                }
                app.logger.success('script ready');
            }
        });
        bundler.on(ScriptBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(ScriptBundler.LINT_EVENT, (result) => {
            if (linterResult) {
                linterResult = Linter.merge(linterResult, result);
            } else {
                linterResult = result;
            }
        });
        bundler.on(ScriptBundler.ANALYSIS_EVENT, (result) => {
            analysis = result;
        });
        bundler.on(ScriptBundler.WARN_EVENT, (message) => {
            app.logger.warn(message);
        });
        bundler.on(ScriptBundler.WRITE_EVENT, (file) => {
            logFile(file);
        });
        await bundler.setup({
            input: entry,
            output,
            format: options.format,
            name: options.name,
            targets: options.targets,
            bundle: options.bundle,
            production: options.production,
            map: options.map,
            lint: options.lint,
            analyze: options.analyze,
            polyfill: options.polyfill,
            typings: options.typings,
            jsx: {
                module: options['jsx.module'],
                pragma: options['jsx.pragma'],
                pragmaFrag: options['jsx.pragmaFrag'],
            },
        });
        await bundler.build();
        await bundler.write();

        // collect the generated Bundle
        return bundler;
    } else if (isStyleFile(entry.path)) {
        // Style file
        let bundler = new StyleBundler();
        let linterResult;
        bundler.on(StyleBundler.START_EVENT, (input, code, invalidate, child) => {
            if (!child) {
                app.logger.play('generating style...', !code ? input.localPath : '');
            }
        });
        bundler.on(StyleBundler.END_EVENT, (child) => {
            if (!child) {
                app.logger.stop();
                if (linterResult) {
                    app.logger.log(linterResult);
                }
                app.logger.success('style ready');
            }
        });
        bundler.on(StyleBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(StyleBundler.LINT_EVENT, (result) => {
            if (linterResult) {
                linterResult = Linter.merge(linterResult, result);
            } else {
                linterResult = result;
            }
        });
        bundler.on(StyleBundler.WRITE_EVENT, (file) => {
            logFile(file);
        });
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
        let bundler = new HTMLBundler();
        let linterResult;
        bundler.on(HTMLBundler.START_EVENT, (input, code, invalidate, child) => {
            if (!child) {
                app.logger.play('generating html...', !code ? input.localPath : '');
            }
        });
        bundler.on(HTMLBundler.END_EVENT, (child) => {
            if (!child) {
                app.logger.stop();
                if (linterResult) {
                    app.logger.log(linterResult);
                }
                app.logger.success('html ready');
            }
        });
        bundler.on(HTMLBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(HTMLBundler.LINT_EVENT, (result) => {
            if (linterResult) {
                linterResult = Linter.merge(linterResult, result);
            } else {
                linterResult = result;
            }
        });
        bundler.on(HTMLBundler.WRITE_EVENT, (file) => {
            logFile(file);
        });
        await bundler.setup({
            input: entry,
            output,
            title: project.get('name'),
            description: project.get('description'),
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
        let bundler = new WebManifestBundler();
        bundler.on(WebManifestBundler.START_EVENT, (input, code, invalidate, child) => {
            if (!child) {
                app.logger.play('generating webmanifest...', !code ? input.localPath : '');
            }
        });
        bundler.on(WebManifestBundler.END_EVENT, (child) => {
            if (!child) {
                app.logger.stop();
                app.logger.success('webmanifest ready');
            }
        });
        bundler.on(WebManifestBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(WebManifestBundler.WRITE_EVENT, (file) => {
            logFile(file);
        });
        await bundler.setup({
            input: entry,
            output,
            name: project.get('name'),
            description: project.get('description'),
        });
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    }
}
