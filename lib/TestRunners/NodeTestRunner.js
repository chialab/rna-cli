const fs = require('fs');
const path = require('path');
const TestRunner = require('./TestRunner');
const Mocha = require('mocha');
const NYC = require('nyc');
const { addHook } = require('pirates');
const ScriptBundler = require('../Bundlers/ScriptBundler');
require('source-map-support/register');

class NodeTestRunner extends TestRunner {
    async run(files) {
        await super.run(files);

        const mocha = new Mocha(this.options);
        const compiled = {};
        const removeHook = addHook((source, filename) => {
            if (filename in compiled) {
                return compiled[filename].code;
            }
            return source;
        }, {
            exts: ['.js'],
            ignoreNodeModules: false,
        });

        await Promise.all(
            files.map(async (file) => {
                let bundler;
                if (file.path in compiled) {
                    bundler = compiled[file.path].bundler;
                } else {
                    bundler = new ScriptBundler(this.app, this.project);
                    await bundler.setup({
                        input: file,
                        output: file,
                        format: 'cjs',
                        targets: this.options.targets,
                        map: 'inline',
                        assertions: true,
                        lint: false,
                        analyze: false,
                        polyfill: false,
                        typings: false,
                        progress: false,
                        coverage: this.options.coverage,
                        jsx: {
                            module: this.options['jsx.module'],
                            pragma: this.options['jsx.pragma'],
                            pragmaFrag: this.options['jsx.pragmaFrag'],
                        },
                    });
                }
                const { code, watchFiles } = await bundler.build();
                compiled[file.path] = {
                    bundler,
                    code,
                };
                this.addResources(...watchFiles.filter((filePath) => fs.existsSync(filePath)));
                delete require.cache[file.path];
                mocha.addFile(file.path);
            })
        );

        return await new Promise((resolve) => {
            mocha.run((failures) => {
                removeHook();

                let coverage;
                if (this.options.coverage) {
                    coverage = global.__coverage__;
                    if (coverage) {
                        const reportDir = this.project.directory('reports').directory('coverage').directory(`${process.title.split(path.sep).pop()}-${process.version}`);
                        const nyc = new NYC({
                            'check-coverage': true,
                            'per-file': true,
                            'lines': 100,
                            'statements': 100,
                            'functions': 100,
                            'branches': 100,
                            'reporter': ['html', 'lcovonly'],
                            'all': true,
                            'reportDir': reportDir.path,
                            'cwd': this.project.path,
                        });
                        nyc.reset();
                        nyc.writeCoverageFile();
                        nyc.report();
                        nyc.cleanup();
                        delete global.__coverage__;
                    }
                }
                resolve({
                    exitCode: failures ? 1 : 0,
                    coverage,
                    failed: failures.length,
                });
            });
        });
    }
}

module.exports = NodeTestRunner;
