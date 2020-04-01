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
            const Targets = require('../../lib/Targets');
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = new Project(cwd);
            const workspaces = project.workspaces;

            if (options.production && !Object.prototype.hasOwnProperty.call(process.env, 'NODE_ENV')) {
                // Set NODE_ENV environment variable if `--production` flag is set.
                app.logger.info('--------------------------------\nsetting "production" environment\n--------------------------------');
                process.env.NODE_ENV = 'production';
            }

            let entries;
            let outputRelative = false;
            if (options.arguments.length) {
                outputRelative = options.arguments.length > 1 || options.arguments[0].includes('*');

                const isProjectInList = function(list, project) {
                    return !!list.find((entry) => entry instanceof Project && entry.get('name') === project.get('name'));
                };

                entries = project.resolve(options.arguments)
                    .reduce((list, entry) => {
                        if (!(entry instanceof Project)) {
                            list.push(entry);
                            return list;
                        }
                        if (!isProjectInList(list, entry)) {
                            if (options.recursive) {
                                project.getWorkspaceDependencies(entry)
                                    .filter((dep) => !isProjectInList(list, dep))
                                    .forEach((dep) => {
                                        list.push(dep);
                                    });
                            }
                            list.push(entry);
                        }
                        return list;
                    }, []);
            } else {
                entries = workspaces || [project];
            }

            if (!entries.length) {
                throw new Error('missing files to build');
            }

            if (options.link) {
                const linkedFilter = options.link.split(',').map((pattern) => new RegExp(pattern.replace(/\//, '\\/')));
                const filterLinkedDependencies = (project, results = []) => {
                    const dependencies = project.getLinkedDependencies();
                    dependencies
                        .concat(project.workspaces || [])
                        .filter((pkg) => linkedFilter.some((regex) => pkg.get('name').match(regex)))
                        .forEach((pkg) => {
                            if (!results.find((p) => p.get('name') === pkg.get('name'))) {
                                results.push(pkg);
                                filterLinkedDependencies(pkg, results);
                            }
                        });
                    return results;
                };
                const { list } = Project.sort(filterLinkedDependencies(project));
                list.forEach((pkg) => {
                    pkg.linked = true;
                });
                entries.unshift(...list);
            }

            const bundles = [];

            // Process entries.
            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];

                if (entry instanceof Project) {
                    app.logger.heading(`\nbuilding project ${entry.get('name')}:`);
                    app.logger.newline();

                    const libFile = entry.get('lib') && entry.file(entry.get('lib'));
                    const moduleFile = entry.get('module') && entry.file(entry.get('module'));
                    const mainFile = entry.get('main') && entry.file(entry.get('main'));
                    const browserFile = entry.get('browser') && entry.file(entry.get('browser'));
                    const styleFile = entry.get('style') && entry.file(entry.get('style'));

                    let typingsFile;
                    if (typeof options.typings === 'string') {
                        typingsFile = entry.file(options.typings);
                    } else if (options.typings !== false) {
                        if (entry.get('types')) {
                            typingsFile = entry.file(entry.get('types'));
                        }
                    }

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
                        let bundler;
                        if (output && !entry.linked) {
                            bundler = await buildEntry(app, entry, libFile, output, Object.assign({}, options, {
                                targets: options.targets || entry.browserslist,
                                typings: typingsFile || !!options.typings,
                            }));
                            if (bundler && options.watch) {
                                bundles.push(bundler);
                            }
                        } else {
                            if (moduleFile) {
                                bundler = await buildEntry(app, entry, libFile, moduleFile, Object.assign({}, options, {
                                    targets: Targets.fromFeatures('module', 'async').toQuery(),
                                    format: 'esm', lint: !mainFile && options.lint,
                                    typings: !mainFile && (typingsFile || !!options.typings),
                                }));
                                if (bundler && options.watch) {
                                    bundles.push(bundler);
                                }
                            }
                            if (!entry.linked || !moduleFile) {
                                if (mainFile) {
                                    bundler = await buildEntry(app, entry, libFile, mainFile, Object.assign({}, options, {
                                        targets: options.targets || entry.browserslist, format: 'cjs',
                                        typings: typingsFile || !!options.typings,
                                    }));
                                    if (bundler && options.watch) {
                                        bundles.push(bundler);
                                    }
                                }
                            }
                            if (!entry.linked || !(mainFile || moduleFile)) {
                                if (browserFile) {
                                    bundler = await buildEntry(app, entry, libFile, browserFile, Object.assign({}, options, {
                                        targets: options.targets || entry.browserslist,
                                        format: 'umd', typings: typingsFile || !!options.typings,
                                    }));
                                    if (bundler && options.watch) {
                                        bundles.push(bundler);
                                    }
                                }
                            }
                            const distDir = entry.directories.dist || entry.directories.lib;
                            if (styleFile && distDir) {
                                const styleOutput = distDir.file(
                                    (mainFile && `${mainFile.basename}.css`) ||
                                    (moduleFile && `${moduleFile.basename}.css`) ||
                                    (browserFile && `${browserFile.basename}.css`) ||
                                    `${project.scopeName}.css`,
                                );
                                bundler = await buildEntry(app, entry, styleFile, styleOutput, Object.assign({}, options, { targets: options.targets || entry.browserslist }));
                                if (bundler && options.watch) {
                                    bundles.push(bundler);
                                }
                            }
                            if (libFile.extname === '.html' && (entry.directories.public || entry.directories.lib)) {
                                bundler = await buildEntry(app, entry, libFile, entry.directories.public || entry.directories.lib, Object.assign({}, options, { targets: options.targets || entry.browserslist }));
                                if (bundler && options.watch) {
                                    bundles.push(bundler);
                                }
                            }
                        }
                        if (!bundler) {
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
                            const moduleOutput = mainFile ? mainFile : output;
                            const bundler = await buildEntry(app, entry, moduleFile, moduleOutput, Object.assign({ bundle: true }, options, {
                                targets: options.targets || entry.browserslist,
                                typings: typingsFile || !!options.typings,
                            }));
                            if (bundler && options.watch) {
                                // collect the generated Bundle.
                                bundles.push(bundler);
                            }
                        }

                        if (styleFile) {
                            const styleOutput = mainFile ?
                                mainFile.parent.file(`${mainFile.basename}.css`) :
                                output;

                            const bundler = await buildEntry(app, entry, styleFile, styleOutput, Object.assign({}, options, {
                                targets: options.targets || entry.browserslist,
                            }));
                            if (bundler && options.watch) {
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

                    let typingsFile;
                    if (typeof options.typings === 'string') {
                        typingsFile = project.file(options.typings);
                    } else if (options.typings) {
                        if (entry.get('types')) {
                            typingsFile = project.file(entry.get('types'));
                        }
                    }

                    let bundler = await buildEntry(app, project, entry, output, Object.assign({}, options, {
                        targets: options.targets || project.browserslist,
                        typings: typingsFile || !!options.typings,
                    }));
                    if (bundler && options.watch) {
                        // collect the generated Bundle.
                        bundles.push(bundler);
                    }
                }
            }

            // once bundles are generated, check for watch option.
            if (options.watch) {
                const statuses = new WeakMap();
                const collectedFiles = [];
                let promise = Promise.resolve();
                let timeout;

                const reBuild = async (bundle, files) => {
                    const status = statuses.get(bundle) || {};
                    if (files) {
                        status.invalidate = files;
                    }
                    statuses.set(bundle, status);
                    if (status.running && !status.invalidate || status.invalidate.length === 0) {
                        return;
                    }
                    const invalidate = status.invalidate;
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
                    ignore: (file) => !filterChangedBundles(bundles, [file]).length,
                }, async (eventType, file) => {
                    if (eventType === 'unlink') {
                        app.logger.info(`${file.path} removed`);
                    } else {
                        app.logger.info(`${project.relative(file)} changed`);
                    }
                    collectedFiles.push(file);
                    clearTimeout(timeout);

                    timeout = setTimeout(async () => {
                        const files = collectedFiles.slice(0);
                        collectedFiles.splice(0, collectedFiles.length);
                        await promise;

                        const bundlesWithChanges = filterChangedBundles(bundles, files);
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
            return bundles;
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

function bundlerToType(bundler) {
    switch (bundler.name) {
        case 'ScriptBundler':
            return 'script';
        case 'StyleBundler':
            return 'style';
        case 'HTMLBundler':
            return 'html';
        case 'WebManifestBundler':
            return 'webmanifest';
        case 'IconBundler':
            return 'icon';
        case 'CopyBundler':
            return 'asset';
    }
    return '';
}

function formatTime(millis) {
    let minutes = Math.floor(millis / 60000);
    let seconds = ((millis % 60000) / 1000).toFixed(0);
    if (!minutes) {
        return `${seconds}s`;
    }
    return `${minutes}:${`${seconds}`.padStart(2, '0')}m`;
}

async function buildEntry(app, project, entry, output, options) {
    const { isJSFile, isStyleFile, isHTMLFile, isWebManifestFile } = require('../../lib/File');
    const Linter = require('../../lib/Linters/Linter');

    function logFile(output) {
        if (output) {
            const { size, zipped } = output.size;
            app.logger.info(project.relative(output), `${size}, ${zipped} zipped`);
        }
    }

    if (isJSFile(entry.path)) {
        const ScriptBundler = require('../../lib/Bundlers/ScriptBundler');
        // Javascript file
        let bundler = new ScriptBundler();
        let analysis;
        let buildStarted = false;
        bundler.on(ScriptBundler.BUILD_START, (input, code, child) => {
            if (!child) {
                app.logger.play(`generating ${bundlerToType(bundler)}`, code ? 'inline' : project.relative(input));
                buildStarted = Date.now();
            } else {
                app.logger.play(`generating ${bundlerToType(bundler)} > ${bundlerToType(child)}`, code ? 'inline' : project.relative(input));
            }
        });
        bundler.on(ScriptBundler.BUILD_END, (input, code, child) => {
            app.logger.stop();
            if (!child) {
                app.logger.success(`${bundlerToType(bundler)} ready`, formatTime(Date.now() - buildStarted));
            } else if (buildStarted) {
                app.logger.play(`generating ${bundlerToType(bundler)}...`, code ? 'inline' : project.relative(input));
            }
        });
        bundler.on(ScriptBundler.BUNDLE_END, () => {
            if (bundler.linter.hasWarnings() || bundler.linter.hasErrors()) {
                app.logger.log(Linter.format(bundler.linter.result));
            }
            if (analysis) {
                app.logger.log(ScriptBundler.formatBundleAnalysis(analysis));
            }
        });
        bundler.on(ScriptBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(ScriptBundler.ANALYSIS_EVENT, (result) => {
            analysis = result;
        });
        bundler.on(ScriptBundler.WARN_EVENT, (message) => {
            app.logger.warn(message);
        });
        bundler.on(ScriptBundler.WRITE_START, (child) => {
            if (!child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.play(`writing ${bundlerToType(bundler)} > ${bundlerToType(child)}...`);
            }
        });
        bundler.on(ScriptBundler.WRITE_PROGRESS, (file) => {
            logFile(file);
        });
        bundler.on(ScriptBundler.WRITE_END, (child) => {
            app.logger.stop();
            if (child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.newline();
            }
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
            lint: options.lint !== false,
            cache: options.cache !== false,
            analyze: options.analyze,
            typings: options.typings,
            jsx: {
                module: options['jsx.module'],
                pragma: options['jsx.pragma'],
                pragmaFrag: options['jsx.pragmaFrag'],
                pragmaDefault: options['jsx.pragmaDefault'],
            },
        });
        await bundler.build();
        await bundler.write();

        // collect the generated Bundle
        return bundler;
    } else if (isStyleFile(entry.path)) {
        const StyleBundler = require('../../lib/Bundlers/StyleBundler');
        // Style file
        let bundler = new StyleBundler();
        let buildStarted = false;
        bundler.on(StyleBundler.BUILD_START, (input, code, child) => {
            if (!child) {
                app.logger.play(`generating ${bundlerToType(bundler)}...`, !code ? project.relative(input) : '');
                buildStarted = Date.now();
            } else {
                app.logger.play(`generating ${bundlerToType(bundler)} > ${bundlerToType(child)}...`, code ? 'inline' : project.relative(input));
            }
        });
        bundler.on(StyleBundler.BUILD_END, (input, code, child) => {
            app.logger.stop();
            if (!child) {
                app.logger.success(`${bundlerToType(bundler)} ready`, formatTime(Date.now() - buildStarted));
            } else if (buildStarted) {
                app.logger.play(`generating ${bundlerToType(bundler)}...`, !code ? project.relative(input) : '');
            }
        });
        bundler.on(StyleBundler.BUNDLE_END, () => {
            if (bundler.linter.hasWarnings() || bundler.linter.hasErrors()) {
                app.logger.log(Linter.format(bundler.linter.result));
            }
        });
        bundler.on(StyleBundler.WARN_EVENT, (message) => {
            app.logger.warn(message);
        });
        bundler.on(StyleBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(StyleBundler.WRITE_START, (child) => {
            if (!child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.play(`writing ${bundlerToType(bundler)} > ${bundlerToType(child)}...`);
            }
        });
        bundler.on(StyleBundler.WRITE_PROGRESS, (file) => {
            logFile(file);
        });
        bundler.on(StyleBundler.WRITE_END, (child) => {
            app.logger.stop();
            if (child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.newline();
            }
        });
        await bundler.setup({
            input: entry,
            output,
            targets: options.targets,
            production: options.production,
            map: options.map,
            lint: options.lint !== false,
        });
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    } else if (isHTMLFile(entry.path)) {
        const HTMLBundler = require('../../lib/Bundlers/HTMLBundler');
        let bundler = new HTMLBundler();
        let buildStarted = false;
        bundler.on(HTMLBundler.BUILD_START, (input, code, child) => {
            if (!child) {
                app.logger.play(`generating ${bundlerToType(bundler)}...`, !code ? project.relative(input) : '');
                buildStarted = Date.now();
            } else {
                app.logger.play(`generating ${bundlerToType(bundler)} > ${bundlerToType(child)}...`, code ? 'inline' : project.relative(input));
            }
        });
        bundler.on(HTMLBundler.BUILD_END, (input, code, child) => {
            app.logger.stop();
            if (!child) {
                app.logger.success(`${bundlerToType(bundler)} ready`, formatTime(Date.now() - buildStarted));
            } else if (buildStarted) {
                app.logger.play(`generating ${bundlerToType(bundler)}...`, !code ? project.relative(input) : '');
            }
        });
        bundler.on(HTMLBundler.BUNDLE_END, () => {
            if (bundler.linter.hasWarnings() || bundler.linter.hasErrors()) {
                app.logger.log(Linter.format(bundler.linter.result));
            }
        });
        bundler.on(HTMLBundler.WARN_EVENT, (message) => {
            app.logger.warn(message);
        });
        bundler.on(HTMLBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(HTMLBundler.WRITE_START, (child) => {
            if (!child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.play(`writing ${bundlerToType(bundler)} > ${bundlerToType(child)}...`);
            }
        });
        bundler.on(HTMLBundler.WRITE_PROGRESS, (file) => {
            logFile(file);
        });
        bundler.on(HTMLBundler.WRITE_END, (child) => {
            app.logger.stop();
            if (child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.newline();
            }
        });
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
        await bundler.build();
        await bundler.write();
        // collect the generated Bundle
        return bundler;
    } else if (isWebManifestFile(entry.path)) {
        const WebManifestBundler = require('../../lib/Bundlers/WebManifestBundler');
        let bundler = new WebManifestBundler();
        let buildStarted = false;
        bundler.on(WebManifestBundler.BUILD_START, (input, code, child) => {
            if (!child) {
                app.logger.play('generating webmanifest...', !code ? project.relative(input) : '');
                buildStarted = Date.now();
            } else {
                app.logger.play(`generating ${bundlerToType(bundler)} > ${bundlerToType(child)}...`, code ? 'inline' : project.relative(input));
            }
        });
        bundler.on(WebManifestBundler.BUILD_END, (input, code, child) => {
            app.logger.stop();
            if (!child) {
                app.logger.success(`${bundlerToType(bundler)} ready`, formatTime(Date.now() - buildStarted));
            } else if (buildStarted) {
                app.logger.play(`generating ${bundlerToType(bundler)}...`, !code ? project.relative(input) : '');
            }
        });
        bundler.on(WebManifestBundler.ERROR_EVENT, () => {
            app.logger.stop();
        });
        bundler.on(WebManifestBundler.WRITE_START, (child) => {
            if (!child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.play(`writing ${bundlerToType(bundler)} > ${bundlerToType(child)}...`);
            }
        });
        bundler.on(WebManifestBundler.WRITE_PROGRESS, (file) => {
            logFile(file);
        });
        bundler.on(WebManifestBundler.WRITE_END, (child) => {
            app.logger.stop();
            if (child) {
                app.logger.play(`writing ${bundlerToType(bundler)}...`);
            } else {
                app.logger.newline();
            }
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
