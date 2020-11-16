const { promises: { stat } } = require('fs');
const path = require('path');
const Mocha = require('mocha');
const ScriptBundler = require('../Bundlers/ScriptBundler');
const TestRunner = require('./TestRunner');
const Reporter = require('./Reporter');
// require('source-map-support/register');

class NodeTestRunner extends TestRunner {
    get name() {
        return 'Node';
    }

    /**
     * @inheritdoc
     */
    async setup(options) {
        await super.setup(options);
        this.addEnvironments(`node ${process.version}`);
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

        let bundler = new ScriptBundler();
        bundler.on(ScriptBundler.BUILD_PROGRESS_EVENT, (file) => {
            this.emit(NodeTestRunner.PREPARE_PROGRESS_EVENT, file);
        });
        await bundler.setup({
            code: inputCode,
            input: this.entryPoint,
            root: this.options.root,
            output: this.testDir,
            bundle: true,
            format: 'cjs',
            targets: this.options.targets,
            map: 'inline',
            lint: false,
            analyze: false,
            typings: false,
            progress: false,
            coverage: this.options.coverage,
            jsx: this.options.jsx,
        });

        let { watchFiles } = await bundler.build();
        let resources = (await Promise.all(
            watchFiles.map(async (filePath) => {
                try {
                    await stat(filePath);
                } catch (err) {
                    return false;
                }
            })
        )).filter(Boolean);
        this.addResources(...resources);

        await bundler.write();
        // GC
        bundler = null;

        this.emit(NodeTestRunner.PREPARE_END_EVENT);
    }

    /**
     * @inheritdoc
     */
    async run() {
        let { id } = await super.run();

        this.emit(NodeTestRunner.RUN_START_EVENT);

        const mocha = this.mocha = new Mocha(Object.assign({
            reporter: Reporter,
            useInlineDiffs: true,
        }, this.options));

        delete require.cache[this.entryPoint.path];
        mocha.addFile(this.entryPoint.path);

        let result = await new Promise((resolve) => {
            delete global.__coverage__;
            require('chai/register-assert');
            require('chai/register-expect');
            require('chai/register-should');
            let runner = mocha.run(async (failures, reporter) => {
                if (global.__coverage__) {
                    await reporter.addCoverage(global.__coverage__, `${process.title.split(path.sep).pop()}-${process.version}`);
                    delete global.__coverage__;
                }

                resolve({
                    exitCode: failures ? 1 : 0,
                    reporter,
                });
            });
            runner.on(Mocha.Runner.constants.EVENT_TEST_BEGIN, (test) => {
                this.emit(NodeTestRunner.RUN_PROGRESS_EVENT, test.titlePath().join(' > '));
            });
        });

        if (!this.isRunning(id)) {
            return;
        }

        this.result = result;
        this.emit(NodeTestRunner.RUN_END_EVENT, result);

        return this.result;
    }
}

module.exports = NodeTestRunner;
