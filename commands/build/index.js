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
        .option('--output <file|directory>', 'The destination file.')
        .option('[--watch]', 'Watch sources and rebuild on files changes.')
        .option('[--targets]', 'Set specific targets for the build using a [Browserslist](https://github.com/browserslist/browserslist). This query is used by Babel and PostCSS to transpile JavaScript and CSS files in order to be compatible with the specified browsers. Use `--no-targets` to prevent code transpiling.')
        .option('[--name]', 'For JavaScript builds, you can specify the name of the global variable to use for the bundle.')
        .option('[--format]', 'Specify the format of the JavaScript bundle. Available formats are `es`, `umd`, `iife` and `cjs`.')
        .option('[--bundle]', 'Should bundle dependencies along the source files.')
        .option('[--production]', 'Prepare output for production env.')
        .option('[--no-map]', 'Do not produce source map.')
        .option('[--no-lint]', 'Do not lint files before build.')
        .option('[--no-cache]', 'Should not cache global dependencies for memory optimizations.')
        .option('[--recursive]', 'Recursively build monorepo packages.')
        .option('[--jsx.pragma]', 'The JSX pragma to use.')
        .option('[--jsx.pragmaFrag]', 'The JSX pragma fragment to use.')
        .option('[--jsx.module]', 'The module to auto import for JSX pragma.')
        .option('[--typings [file]', 'Generate typescript declarations.')
        .option('[--analyze]', 'Print analytic report for script size.')
        .option('[--link] <package1,package2|pattern>', 'Symlinked dependencies to build along the main bundle.')
        .option('[--serve]', 'Should serve the output folder with livereload.')
        .option('[--port]', 'The server port.')
        .option('[--tunnel]', 'Create a tunnel for the server.')
        .option('[--directory]', 'Should list directories.')
        .option('[--https]', 'Start a server using SSL.')
        .option('[--compress]', 'Activate gzip compression on static files.')
        .action(async (app, options = {}) => {
            const path = require('path');
            const colors = require('colors/safe');
            const Listr = require('listr');
            const { Observable } = require('rxjs');
            const Targets = require('../../lib/Targets');
            const { Project } = require('../../lib/File');
            const Bundler = require('../../lib/Bundlers/Bundler');
            const Linter = require('../../lib/Linters/Linter');
            const Renderer = require('../../lib/Cli/renderer');

            const cwd = process.cwd();
            const project = await Project.init(cwd);
            const workspaces = await project.getWorkspaces();

            let entries;
            let outputRelative = false;
            if (options.arguments.length) {
                outputRelative = options.arguments.length > 1 || options.arguments[0].includes('*');

                const isProjectInList = function(list, project) {
                    return !!list.find((entry) => entry instanceof Project && entry.get('name') === project.get('name'));
                };

                let list = await project.resolve(options.arguments);
                entries = await list.reduce(async (listPromise, entry) => {
                    let list = await listPromise;
                    if (!(entry instanceof Project)) {
                        list.push(entry);
                        return list;
                    }
                    if (!isProjectInList(list, entry)) {
                        if (options.recursive) {
                            let dependencies = await project.getWorkspaceDependencies(entry);
                            dependencies
                                .filter((dep) => !isProjectInList(list, dep))
                                .forEach((dep) => {
                                    list.push(dep);
                                });
                        }
                        list.push(entry);
                    }

                    return list;
                }, Promise.resolve([]));
            } else {
                entries = workspaces || [project];
            }

            if (!entries.length) {
                throw new Error('missing files to build');
            }

            if (options.link) {
                const linkedFilter = options.link.split(',').map((pattern) => new RegExp(pattern.replace(/\//, '\\/')));
                const filterLinkedDependencies = async (project, results = []) => {
                    let dependencies = await project.getLinkedDependencies();
                    let workspaces = await project.getWorkspaces();
                    await Promise.all(
                        dependencies
                            .concat(workspaces || [])
                            .filter((pkg) => linkedFilter.some((regex) => pkg.get('name').match(regex)))
                            .map(async (pkg) => {
                                if (!results.find((p) => p.get('name') === pkg.get('name'))) {
                                    results.push(pkg);
                                    await filterLinkedDependencies(pkg, results);
                                }
                            })
                    );

                    return results;
                };

                let dependencies = await filterLinkedDependencies(project);
                let { list } = Project.sort(dependencies);
                list.forEach((pkg) => {
                    pkg.linked = true;
                });
                entries.unshift(...list);
            }

            const bundlersList = [];

            // Process entries.
            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];
                let bundlers = [];

                if (entry instanceof Project) {
                    app.logger.heading(`building project ${entry.get('name')}:`);

                    let libFile = entry.get('lib') && entry.file(entry.get('lib'));
                    let moduleFile = entry.get('module') && entry.file(entry.get('module'));
                    let mainFile = entry.get('main') && entry.file(entry.get('main'));
                    let browserFile = entry.get('browser') && entry.file(entry.get('browser'));
                    let styleFile = entry.get('style') && entry.file(entry.get('style'));

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
                        if (output && !entry.linked) {
                            let bundler = await buildEntry(app, entry, libFile, output, Object.assign({}, options, {
                                targets: options.targets || await entry.browserslist(),
                                typings: options.typings === true,
                            }));
                            bundlers.push(bundler);
                            if (options.typings) {
                                let bundler = await buildEntry(app, entry, libFile, output.ext('.d.ts'), Object.assign({}, options, {
                                    format: 'esm',
                                    typings: true,
                                }));
                                bundlers.push(bundler);
                            }
                        } else {
                            if (moduleFile) {
                                let bundler = await buildEntry(app, entry, libFile, moduleFile, Object.assign({}, options, {
                                    targets: Targets.fromFeatures('module', 'async').toQuery(),
                                    format: 'esm',
                                    lint: !mainFile && options.lint,
                                    typings: options.typings === true,
                                }));
                                bundlers.push(bundler);
                                if (options.typings) {
                                    let bundler = await buildEntry(app, entry, libFile, moduleFile.ext('.d.ts'), Object.assign({}, options, {
                                        format: 'esm',
                                        typings: true,
                                    }));
                                    bundlers.push(bundler);
                                }
                            }
                            if (!entry.linked || !moduleFile) {
                                if (mainFile) {
                                    let bundler = await buildEntry(app, entry, libFile, mainFile, Object.assign({}, options, {
                                        targets: options.targets || await entry.browserslist(), format: 'cjs',
                                        typings: options.typings === true,
                                    }));
                                    bundlers.push(bundler);
                                    if (options.typings) {
                                        let bundler = await buildEntry(app, entry, libFile, mainFile.ext('.d.ts'), Object.assign({}, options, {
                                            format: 'esm',
                                            typings: true,
                                        }));
                                        bundlers.push(bundler);
                                    }
                                }
                            }
                            if (!entry.linked || !(mainFile || moduleFile)) {
                                if (browserFile) {
                                    let bundler = await buildEntry(app, entry, libFile, browserFile, Object.assign({}, options, {
                                        targets: options.targets || await entry.browserslist(),
                                        format: 'umd',
                                        typings: options.typings === true,
                                    }));
                                    bundlers.push(bundler);
                                    if (options.typings) {
                                        let bundler = await buildEntry(app, entry, libFile, browserFile.ext('.d.ts'), Object.assign({}, options, {
                                            format: 'esm',
                                            typings: true,
                                        }));
                                        bundlers.push(bundler);
                                    }
                                }
                            }

                            let distDir = entry.directories.dist || entry.directories.lib;
                            if (styleFile && distDir) {
                                let styleOutput = distDir.file(
                                    (mainFile && `${mainFile.basename}.css`) ||
                                    (moduleFile && `${moduleFile.basename}.css`) ||
                                    (browserFile && `${browserFile.basename}.css`) ||
                                    `${project.scopeName}.css`,
                                );
                                let bundler = await buildEntry(app, entry, styleFile, styleOutput, Object.assign({}, options, { targets: options.targets || await entry.browserslist() }));
                                bundlers.push(bundler);
                            }
                            if (libFile.extname === '.html' && (entry.directories.public || entry.directories.lib)) {
                                let bundler = await buildEntry(app, entry, libFile, entry.directories.public || entry.directories.lib, Object.assign({}, options, { targets: options.targets || await entry.browserslist() }));
                                bundlers.push(bundler);
                            }
                        }
                        if (!bundlers.filter(Boolean).length) {
                            throw new Error(`missing "input" option for project ${entry.path}`);
                        }
                    } else if (moduleFile || styleFile) {
                        // retrocompatibility with RNA 2.0
                        if (!output) {
                            if (mainFile) {
                                output = project.directory(mainFile.dirname);
                            } else {
                                throw new Error('missing "output" option');
                            }
                        }

                        if (moduleFile) {
                            let moduleOutput = mainFile ? mainFile : output;
                            let bundler = await buildEntry(app, entry, moduleFile, moduleOutput, Object.assign({ bundle: true }, options, {
                                targets: options.targets || await entry.browserslist(),
                                typings: options.typings === true,
                            }));
                            bundlers.push(bundler);
                            if (options.typings) {
                                let bundler = await buildEntry(app, entry, libFile, moduleOutput.ext('.d.ts'), Object.assign({}, options, {
                                    format: 'esm',
                                    typings: true,
                                }));
                                bundlers.push(bundler);
                            }
                        }

                        if (styleFile) {
                            let styleOutput = mainFile ? mainFile.parent.file(`${mainFile.basename}.css`) : output;
                            let bundler = await buildEntry(app, entry, styleFile, styleOutput, Object.assign({}, options, {
                                targets: options.targets || await entry.browserslist(),
                            }));
                            bundlers.push(bundler);
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

                    let bundler = await buildEntry(app, project, entry, output, Object.assign({}, options, {
                        targets: options.targets || await project.browserslist(),
                        typings: options.typings === true,
                    }));
                    bundlers.push(bundler);
                    if (options.typings) {
                        let bundler = await buildEntry(app, project, entry, output.ext('.d.ts'), Object.assign({}, options, {
                            format: 'esm',
                            typings: true,
                        }));
                        bundlers.push(bundler);
                    }
                }

                let tasksList = [], analysis;
                let warnings = [];
                bundlers.forEach((bundler) => {
                    let bundlerTask, writerTask;
                    let { output } = bundler.options;
                    let files = [];

                    let bundleObserver = new Observable((observer) => {
                        bundler.on(Bundler.BUILD_START, (input, code) => {
                            observer.next(`bundling${code ? ' inline code' : ` (${project.relative(input)})`}...`);
                        });

                        bundler.on(Bundler.BUILD_END, (input, code, child) => {
                            if (!child) {
                                bundlerTask.output = '';
                                observer.complete();
                            }
                        });

                        bundler.on(Bundler.ERROR_EVENT, (error) => {
                            observer.error(error);
                        });

                        bundler.on(Bundler.WARN_EVENT, (message) => {
                            warnings.push(message);
                        });

                        bundler.on(Bundler.ANALYSIS_EVENT, (result) => {
                            if (!analysis) {
                                analysis = result;
                            }
                        });
                    });

                    let writeObserver = new Observable((observer) => {
                        bundler.on(Bundler.WRITE_PROGRESS, (file) => {
                            observer.next(`writing ${project.relative(file)}...`);
                            if (files.indexOf(file) === -1) {
                                files.push(file);
                            }
                        });

                        bundler.on(Bundler.WRITE_END, async (child) => {
                            if (!child) {
                                let outputFiles = await Promise.all(
                                    files.map(async (file) => {
                                        let { size, zipped } = await file.size();
                                        return `${project.relative(file)} (${size}, ${zipped} zipped)`;
                                    })
                                );
                                writerTask.output = outputFiles.join('\n');

                                observer.complete();
                            }
                        });

                        bundler.on(Bundler.ERROR_EVENT, (error) => {
                            observer.error(error);
                        });

                        bundler.on(Bundler.WARN_EVENT, (message) => {
                            warnings.push(message);
                        });
                    });

                    tasksList.push({
                        title: project.relative(output),
                        task: () => new Listr([
                            {
                                title: 'Build',
                                task: (ctx, task) => {
                                    bundlerTask = task;
                                    return bundleObserver;
                                },
                            },
                            {
                                title: 'Write',
                                task: (ctx, task) => {
                                    writerTask = task;
                                    return writeObserver;
                                },
                            },
                        ]),
                    });
                });

                let list = new Listr(tasksList, {
                    concurrent: true,
                    renderer: Renderer,
                }).run();

                await Promise.all([
                    list,
                    ...bundlers
                        .filter(Boolean)
                        .map((bundler) => bundler.toPromise()),
                ]);

                if (warnings.length) {
                    app.logger.newline();
                    app.logger.log(warnings.map((warning) => colors.yellow(warning)).join('\n'));
                }

                let linterResults = bundlers.reduce((result, bundler) => Linter.merge(result, bundler.linter ? bundler.linter.result : {}), {});
                if (linterResults.warningCount || linterResults.errorCount) {
                    app.logger.log(Linter.format(linterResults));
                }

                if (analysis) {
                    app.logger.log(Bundler.formatBundleAnalysis(analysis));
                }

                app.logger.newline();

                if (options.watch) {
                    bundlersList.push(...bundlers);
                }
            }

            // once bundles are generated, check for watch option.
            if (options.watch) {
                const statuses = new WeakMap();
                const collectedFiles = [];
                let promise = Promise.resolve();
                let timeout;

                const reBuild = async (bundle, files) => {
                    let status = statuses.get(bundle) || {};
                    if (files) {
                        status.invalidate = files;
                    }
                    statuses.set(bundle, status);
                    if (status.running && !status.invalidate || status.invalidate.length === 0) {
                        return;
                    }
                    let invalidate = status.invalidate;
                    status.invalidate = [];
                    status.running = true;
                    statuses.set(bundle, status);
                    promise = promise
                        .then(async () => {
                            try {
                                await bundle.build(...invalidate);
                                await bundle.write();
                            } catch (err) {
                                if (err) {
                                    app.logger.error(err);
                                }
                            }
                        });
                    await promise;
                    status.running = false;
                    statuses.set(bundle, status);
                    reBuild(bundle);
                };

                project.watch({
                    ignore: (file) => !filterChangedBundles(bundlersList, [file]).length,
                }, async (eventType, file) => {
                    if (eventType === 'unlink') {
                        app.logger.info(`${file.path} removed`);
                    } else {
                        app.logger.info(`${project.relative(file)} changed`);
                    }
                    collectedFiles.push(file);

                    clearTimeout(timeout);

                    timeout = setTimeout(async () => {
                        let files = collectedFiles.slice(0);
                        collectedFiles.splice(0, collectedFiles.length);
                        await promise;

                        let bundlesWithChanges = filterChangedBundles(bundlersList, files);
                        if (bundlesWithChanges.length === 0) {
                            return true;
                        }

                        app.logger.newline();
                        for (let i = 0; i < bundlesWithChanges.length; i++) {
                            reBuild(bundlesWithChanges[i], files);
                        }
                    }, 200);
                });
            }

            if (options.watch && options.serve) {
                app.exec('serve', {
                    ...options,
                    arguments: typeof options.serve === 'string' ? [options.serve] : options.arguments,
                });
            }

            // resolve build task with the list of generated manifests.
            return bundlersList;
        });
};

function filterChangedBundles(bundles, files) {
    const { realpathSync } = require('fs');
    files = files.map((file) => realpathSync(file.path));
    return bundles
        .filter((bundle) => {
            if (!bundle.files) {
                return [];
            }
            return files.some((file) => bundle.files.includes(file));
        });
}

async function buildEntry(app, project, entry, output, options) {
    const { isJSFile, isStyleFile, isHTMLFile, isWebManifestFile } = require('../../lib/File');

    if (isJSFile(entry.path)) {
        const ScriptBundler = require('../../lib/Bundlers/ScriptBundler');

        let bundler = new ScriptBundler();
        await bundler.setup({
            input: entry,
            output,
            format: options.format,
            name: options.name,
            targets: options.targets,
            bundle: options.bundle,
            production: options.production,
            map: options.map,
            lint: options.lint !== false,
            cache: options.cache !== false,
            analyze: options.analyze,
            typings: options.typings,
            jsx: options.jsx != false ? {
                module: options['jsx.module'],
                pragma: options['jsx.pragma'],
                pragmaFrag: options['jsx.pragmaFrag'],
                pragmaDefault: options['jsx.pragmaDefault'],
            } : false,
        });

        // collect the generated Bundle
        return bundler;
    }

    if (isStyleFile(entry.path)) {
        const StyleBundler = require('../../lib/Bundlers/StyleBundler');

        let bundler = new StyleBundler();
        await bundler.setup({
            input: entry,
            output,
            targets: options.targets,
            production: options.production,
            map: options.map,
            lint: options.lint !== false,
        });

        // collect the generated Bundle
        return bundler;
    }

    if (isHTMLFile(entry.path)) {
        const HTMLBundler = require('../../lib/Bundlers/HTMLBundler');

        let bundler = new HTMLBundler();
        await bundler.setup({
            input: entry,
            output,
            title: project.get('name'),
            description: project.get('description'),
            targets: options.targets,
            production: options.production,
            format: options.format,
            map: options.map,
            lint: options.lint !== false,
            base: Object.prototype.hasOwnProperty.call(options, 'base') ? options.base : undefined,
            icon: Object.prototype.hasOwnProperty.call(options, 'icon') ? options.icon : undefined,
            scripts: Object.prototype.hasOwnProperty.call(options, 'scripts') ? options.scripts : undefined,
            styles: Object.prototype.hasOwnProperty.call(options, 'styles') ? options.styles : undefined,
            webmanifest: Object.prototype.hasOwnProperty.call(options, 'webmanifest') ? options.webmanifest : undefined,
            jsx: {
                module: options['jsx.module'],
                pragma: options['jsx.pragma'],
                pragmaFrag: options['jsx.pragmaFrag'],
                pragmaDefault: options['jsx.pragmaDefault'],
            },
        });

        // collect the generated Bundle
        return bundler;
    }

    if (isWebManifestFile(entry.path)) {
        const WebManifestBundler = require('../../lib/Bundlers/WebManifestBundler');

        let bundler = new WebManifestBundler();
        await bundler.setup({
            input: entry,
            output,
            name: project.get('name'),
            description: project.get('description'),
        });

        // collect the generated Bundle
        return bundler;
    }
}
