const { EventEmitter } = require('events');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createSourceMapStore } = require('istanbul-lib-source-maps');
const { createContext, getDefaultWatermarks } = require('istanbul-lib-report');
const { create: createReporter } = require('istanbul-reports');

/**
 * An abstract test runner.
 */
class TestRunner extends EventEmitter {
    static get PREPARE_START_EVENT() { return 'preparestart'; }
    static get PREPARE_PROGRESS_EVENT() { return 'prepareprogress'; }
    static get PREPARE_END_EVENT() { return 'prepareend'; }
    static get RUN_START_EVENT() { return 'runstart'; }
    static get RUN_PROGRESS_EVENT() { return 'runprogress'; }
    static get RUN_END_EVENT() { return 'runend'; }
    static get RUN_STOP_EVENT() { return 'runstop'; }

    /**
     * The runner name.
     * @type {string}
     */
    get name() {
        return this.constructor.name;
    }

    /**
     * A list of resources used by the runner.
     * @type {Array<string>}
     */
    get files() {
        return this.resources.slice(0);
    }

    /**
     * Add runner resources.
     * @param {...Array<string>} resources A list of resources to add.
     * @return {void}
     */
    addResources(...resources) {
        resources.forEach((res) => {
            if (this.resources.indexOf(res) === -1) {
                this.resources.push(res);
            }
        });
    }

    async setup(options) {
        if (!options.root) {
            throw `missing "root" options for ${this.name}`;
        }
        this.testDir = options.root.directory('__generated__').directory(this.name);
        this.coverageDir = options.root.directory('__coverage__');
        this.entryPoint = this.testDir.file('__entry__.js');
        this.options = Object.assign({}, options);
        this.resources = [];
    }

    /**
     * Build test files.
     * @param {File[]} files A list of spec files.
     * @return {Promise<void>}
     */
    async build(/* files */) {
        await this.testDir.ensure();
        await this.testDir.empty();
        await this.entryPoint.write('');
    }

    /**
     * Run the tests.
     * @return {Promise<Reporter>}
     */
    async run() {
        if (this.runId && !this.done) {
            await this.stop();
        }
        this.done = false;
        this.runId = this.runId || 0;
        this.runId++;
    }

    async saveCoverage(reporter) {
        let reportDir = this.coverageDir.directory(reporter.name);
        let coverageMap = createCoverageMap(reporter.getReport().coverage || {});
        let remappedCoverageMap = await createSourceMapStore().transformCoverage(coverageMap);
        let context = createContext({
            dir: reportDir.path,
            watermarks: getDefaultWatermarks(),
            coverageMap: remappedCoverageMap,
        });
        createReporter('html').execute(context);
        createReporter('lcovonly').execute(context);
    }

    /**
     * Check if the runner is still running.
     * @param {number} id The run id.
     * @return {boolean}
     */
    isRunning(id) {
        return id === this.runId;
    }

    /**
     * Stop a test.
     * @return {Promise<void>}
     */
    async stop() {
        this.emit(this.constructor.RUN_STOP_EVENT);
    }
}

module.exports = TestRunner;
