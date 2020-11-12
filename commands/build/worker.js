const { fork } = require('child_process');

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

if (!process.send) {
    module.exports = function buildEntry(app, project, entry, output, options) {
        return new Promise((resolve, reject) => {
            const worker = fork(__filename, [
                project.path,
                entry.path,
                output.path,
                JSON.stringify(options),
            ]);
            worker.on('message', (event) => {
                if (event.name === 'writeend') {
                    resolve();
                }
            });
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
        });
    };
} else {
    (async () => {
        const { Project, isJSFile, isStyleFile, isHTMLFile, isWebManifestFile, convertPath } = require('../../lib/File');
        const [, , projectPath, entryPath, outputPath, optionsJson] = process.argv;
        const options = JSON.parse(optionsJson);
        const entry = convertPath(entryPath);
        const output = convertPath(outputPath);
        const project = await Project.init(projectPath);

        function send(event, data) {
            process.send({
                name: event,
                data,
            });
        }

        function sendFile(output) {
            if (output) {
                const { size, zipped } = output.size;
                send('output', {
                    file: output.path,
                    size,
                    zipped,
                });
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
                    send(ScriptBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        input: input.path,
                        code,
                    });
                    buildStarted = Date.now();
                } else {
                    send(ScriptBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(ScriptBundler.BUILD_END, (input, code, child) => {
                if (!child) {
                    send(ScriptBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                } else if (buildStarted) {
                    send(ScriptBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(ScriptBundler.BUNDLE_END, () => {
                send(ScriptBundler.BUNDLE_END, {
                    lint: (bundler.linter.hasWarnings() || bundler.linter.hasErrors()) ? bundler.linter.result : undefined,
                    analysis,
                });
            });
            bundler.on(ScriptBundler.ANALYSIS_EVENT, (result) => {
                analysis = result;
            });
            bundler.on(ScriptBundler.ERROR_EVENT, (error) => {
                send(ScriptBundler.ERROR_EVENT, error);
            });
            bundler.on(ScriptBundler.WARN_EVENT, (message) => {
                send(ScriptBundler.WARN_EVENT, message);
            });
            bundler.on(ScriptBundler.WRITE_START, (child) => {
                if (!child) {
                    send(ScriptBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                    });
                } else {
                    send(ScriptBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                }
            });
            bundler.on(ScriptBundler.WRITE_PROGRESS, (file) => {
                sendFile(file);
            });
            bundler.on(ScriptBundler.WRITE_END, (child) => {
                if (child) {
                    send(ScriptBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                } else {
                    send(ScriptBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                    });
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
                jsx: options.jsx != false ? {
                    module: options['jsx.module'],
                    pragma: options['jsx.pragma'],
                    pragmaFrag: options['jsx.pragmaFrag'],
                    pragmaDefault: options['jsx.pragmaDefault'],
                } : false,
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
                    send(StyleBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        input: input.path,
                        code,
                    });
                    buildStarted = Date.now();
                } else {
                    send(StyleBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(StyleBundler.BUILD_END, (input, code, child) => {
                if (!child) {
                    send(StyleBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                } else if (buildStarted) {
                    send(StyleBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(StyleBundler.BUNDLE_END, () => {
                send(StyleBundler.BUNDLE_END, {
                    lint: (bundler.linter.hasWarnings() || bundler.linter.hasErrors()) ? bundler.linter.result : undefined,
                });
            });
            bundler.on(StyleBundler.ERROR_EVENT, (error) => {
                send(StyleBundler.ERROR_EVENT, error);
            });
            bundler.on(StyleBundler.WARN_EVENT, (message) => {
                send(StyleBundler.WARN_EVENT, message);
            });
            bundler.on(StyleBundler.WRITE_START, (child) => {
                if (!child) {
                    send(StyleBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                    });
                } else {
                    send(StyleBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                }
            });
            bundler.on(StyleBundler.WRITE_PROGRESS, (file) => {
                sendFile(file);
            });
            bundler.on(StyleBundler.WRITE_END, (child) => {
                if (child) {
                    send(StyleBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                } else {
                    send(StyleBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                    });
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
                    send(HTMLBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        input: input.path,
                        code,
                    });
                    buildStarted = Date.now();
                } else {
                    send(HTMLBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(HTMLBundler.BUILD_END, (input, code, child) => {
                if (!child) {
                    send(HTMLBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                } else if (buildStarted) {
                    send(HTMLBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(HTMLBundler.BUNDLE_END, () => {
                send(HTMLBundler.BUNDLE_END);
            });
            bundler.on(HTMLBundler.ERROR_EVENT, (error) => {
                send(HTMLBundler.ERROR_EVENT, error);
            });
            bundler.on(HTMLBundler.WARN_EVENT, (message) => {
                send(HTMLBundler.WARN_EVENT, message);
            });
            bundler.on(HTMLBundler.WRITE_START, (child) => {
                if (!child) {
                    send(HTMLBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                    });
                } else {
                    send(HTMLBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                }
            });
            bundler.on(HTMLBundler.WRITE_PROGRESS, (file) => {
                sendFile(file);
            });
            bundler.on(HTMLBundler.WRITE_END, (child) => {
                if (child) {
                    send(HTMLBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                } else {
                    send(HTMLBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                    });
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
                    send(WebManifestBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        input: input.path,
                        code,
                    });
                    buildStarted = Date.now();
                } else {
                    send(WebManifestBundler.BUILD_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(WebManifestBundler.BUILD_END, (input, code, child) => {
                if (!child) {
                    send(WebManifestBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                } else if (buildStarted) {
                    send(WebManifestBundler.BUILD_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                        duration: Date.now() - buildStarted,
                        input: input.path,
                        code,
                    });
                }
            });
            bundler.on(WebManifestBundler.ERROR_EVENT, (error) => {
                send(WebManifestBundler.ERROR_EVENT, error);
            });
            bundler.on(WebManifestBundler.WRITE_START, (child) => {
                if (!child) {
                    send(WebManifestBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                    });
                } else {
                    send(WebManifestBundler.WRITE_START, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                }
            });
            bundler.on(WebManifestBundler.WRITE_PROGRESS, (file) => {
                sendFile(file);
            });
            bundler.on(WebManifestBundler.WRITE_END, (child) => {
                if (child) {
                    send(WebManifestBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                        child: bundlerToType(child),
                    });
                } else {
                    send(WebManifestBundler.WRITE_END, {
                        bundler: bundlerToType(bundler),
                    });
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
    })();
}
