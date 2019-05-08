const TestRunner = require('./TestRunner');
const Mocha = require('mocha');
const { Collector, Reporter, config } = require('istanbul');
const { addHook } = require('pirates');
const ScriptBundler = require('../Bundlers/ScriptBundler');
require('source-map-support/register');

class NodeTestRunner extends TestRunner {
    async setup(options = {}) {
        await super.setup(options);
        this.mocha = new Mocha(options);
    }

    async run(files) {
        const compiled = {};
        const removeHook = addHook((source, filename) => {
            if (filename in compiled) {
                return compiled[filename];
            }
            return source;
        }, {
            exts: ['.js'],
            ignoreNodeModules: false,
        });

        await Promise.all(
            files.map(async (file) => {
                const bundler = new ScriptBundler(this.app, this.project);
                await bundler.setup({
                    input: file,
                    output: file,
                    format: 'cjs',
                    targets: this.options.targets,
                    map: true,
                    assertions: true,
                    lint: false,
                    analyze: false,
                    polyfill: false,
                    typings: false,
                    progress: false,
                    jsx: {
                        module: this.options['jsx.module'],
                        pragma: this.options['jsx.pragma'],
                        pragmaFrag: this.options['jsx.pragmaFrag'],
                    },
                });
                const { code } = await bundler.build();
                compiled[file.path] = code;
                this.mocha.addFile(file.path);
            })
        );

        return await new Promise((resolve) => {
            this.mocha.run((failures) => {
                removeHook();

                let coverage;
                if (this.options.coverage) {
                    const collector = new Collector();
                    const reporter = new Reporter(config.loadObject({
                        reporting: {
                            print: 'summary',
                            reports: [ 'lcov' ],
                            dir: this.project.directory(`reports/coverage/${process.title}-${process.version}`).path,
                        },
                    }));
                    coverage = global.__coverage__;
                    collector.add(coverage);
                    delete global.__coverage__;
                    reporter.addAll(['lcov']);
                    reporter.write(collector, true, () => {});
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
