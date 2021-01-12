const Mocha = require('mocha');
const {
    EVENT_TEST_BEGIN,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_TEST_PENDING,
    EVENT_SUITE_BEGIN,
} = Mocha.Runner.constants;
const ScriptBundler = require('../Bundlers/ScriptBundler');
const TestRunner = require('./TestRunner');
const { Reporter } = require('./Reporter');
require('source-map-support/register');

class NodeTestRunner extends TestRunner {
    get name() {
        return 'Node';
    }

    /**
     * @inheritdoc
     */
    async build(files) {
        this.emit(NodeTestRunner.PREPARE_START_EVENT);
        await super.build(files);

        let inputCode = files
            .filter((file) => file.path.indexOf(this.testDir.path) !== 0)
            .filter((file) => file.path.indexOf(this.coverageDir.path) !== 0)
            .map((file) => `import '${file.path}';`).join('\n');
        let chunks = files
            .filter((file) => file.path.indexOf(this.testDir.path) !== 0)
            .filter((file) => file.path.indexOf(this.coverageDir.path) !== 0)
            .reduce((acc, file) => {
                acc[file.basename] = [file.path];
                return acc;
            }, {});

        let bundler = new ScriptBundler();
        bundler.on(ScriptBundler.BUILD_PROGRESS_EVENT, (file) => {
            this.emit(NodeTestRunner.PREPARE_PROGRESS_EVENT, file);
        });
        bundler.on(ScriptBundler.WARN_EVENT, (warning) => {
            this.emit(NodeTestRunner.PREPARE_WARN_EVENT, warning);
        });

        await bundler.setup({
            code: inputCode,
            input: this.entryPoint,
            root: this.options.root,
            chunks,
            output: this.testDir,
            bundle: true,
            format: 'cjs',
            targets: this.options.targets,
            map: 'inline',
            lint: false,
            analyze: false,
            production: false,
            checkDependencies: false,
            preserveEntrySignatures: false,
            coverage: this.options.coverage,
            jsx: this.options.jsx,
        });

        let { watchFiles } = await bundler.build();
        await this.addResources(...watchFiles);

        await bundler.write();
        // GC
        bundler = null;

        this.emit(NodeTestRunner.PREPARE_END_EVENT);
    }

    /**
     * @inheritdoc
     */
    async run() {
        await super.run();
        let id = this.runId;
        let NullReporter = function() { };
        let mocha = this.mocha = new Mocha(Object.assign({
            reporter: NullReporter,
            useInlineDiffs: true,
        }, this.options));

        delete require.cache[this.entryPoint.path];
        mocha.addFile(this.entryPoint.path);

        let reporter = new Reporter(`Node ${process.version}`);
        this.emit(NodeTestRunner.RUN_START_EVENT, [reporter]);

        await new Promise((resolve, reject) => {
            delete global.__coverage__;
            require('chai/register-assert');
            require('chai/register-expect');
            require('chai/register-should');
            let runner = mocha.run(async () => {
                if (global.__coverage__) {
                    reporter.mergeCoverage(global.__coverage__);
                    await this.saveCoverage(reporter);
                    delete global.__coverage__;
                }

                resolve();
            });

            runner.on(EVENT_TEST_BEGIN, (test) => {
                this.emit(NodeTestRunner.RUN_PROGRESS_EVENT, reporter, test.titlePath().join(' > '));
            });

            runner.on(EVENT_SUITE_BEGIN, (suite) => {
                let addTests = (suite) => {
                    if (suite.suites && suite.suites.length) {
                        suite.suites.forEach((child) => addTests(child));
                    }
                    if (suite.tests && suite.tests.length) {
                        suite.tests.forEach((test) => reporter.add(test.titlePath()));
                    }
                };

                addTests(suite);
            });

            runner.on(EVENT_TEST_PENDING, (test) => {
                try {
                    reporter.skip(test.titlePath());
                } catch (error) {
                    reject(error);
                }
            });

            runner.on(EVENT_TEST_PASS, (test) => {
                try {
                    reporter.pass(test.titlePath());
                } catch (error) {
                    reject(error);
                }
            });

            runner.on(EVENT_TEST_FAIL, (test, err) => {
                try {
                    reporter.fail(test.titlePath(), err);
                } catch (error) {
                    reject(error);
                }
            });
        });

        if (!this.isRunning(id)) {
            return;
        }

        this.done = true;
        this.emit(NodeTestRunner.RUN_END_EVENT, reporter);

        return reporter;
    }
}

module.exports = NodeTestRunner;
