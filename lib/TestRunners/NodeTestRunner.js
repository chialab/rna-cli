const { existsSync } = require('fs');
const path = require('path');
const Mocha = require('mocha');
const ScriptBundler = require('../Bundlers/ScriptBundler');
const TestRunner = require('./TestRunner');
// require('source-map-support/register');

class NodeTestRunner extends TestRunner {
    async run(files) {
        const { id } = await super.run(files);

        const inputCode = files
            .filter((file) => file.path.indexOf(this.testDir.path) !== 0)
            .filter((file) => file.path.indexOf(this.coverageDir.path) !== 0)
            .map((file) => `import '${file.path}';`).join('\n');
        const testFile = this.testDir.file('__specs__.js');
        let bundler = new ScriptBundler();

        this.emit(NodeTestRunner.START_EVENT);
        this.emit(NodeTestRunner.PREPARE_START_EVENT);

        await bundler.setup({
            code: inputCode,
            input: testFile,
            root: this.options.root,
            output: this.testDir,
            bundle: true,
            format: 'cjs',
            targets: this.options.targets,
            map: 'inline',
            assertions: true,
            lint: false,
            analyze: false,
            typings: false,
            progress: false,
            coverage: this.options.coverage,
            jsx: {
                module: this.options['jsx.module'],
                pragma: this.options['jsx.pragma'],
                pragmaFrag: this.options['jsx.pragmaFrag'],
            },
        });

        if (!this.isRunning(id)) {
            return;
        }

        const { watchFiles } = await bundler.build();
        await bundler.write();
        // GC
        bundler = null;

        if (!this.isRunning(id)) {
            return;
        }

        this.emit(NodeTestRunner.PREPARE_END_EVENT);
        this.addResources(...watchFiles.filter((filePath) => existsSync(filePath)));

        const mocha = this.mocha = new Mocha(Object.assign({
            useInlineDiffs: true,
        }, this.options));

        delete require.cache[testFile.path];
        mocha.addFile(testFile.path);

        const result = await new Promise((resolve) => {
            delete global.__coverage__;
            mocha.run(async (failures) => {
                if (this.options.coverage && global.__coverage__) {
                    await this.reportCoverage(global.__coverage__, `${process.title.split(path.sep).pop()}-${process.version}`);
                    delete global.__coverage__;
                }
                resolve({
                    exitCode: failures ? 1 : 0,
                    coverage: this.coverageMap.toJSON(),
                    failed: failures.length,
                });
            });
        });

        if (!this.isRunning(id)) {
            return;
        }

        this.result = result;
        this.emit(NodeTestRunner.END_EVENT, this.result);

        return this.result;
    }
}

module.exports = NodeTestRunner;
