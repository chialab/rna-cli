const { EventEmitter } = require('events');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createSourceMapStore } = require('istanbul-lib-source-maps');
const { createContext, getDefaultWatermarks } = require('istanbul-lib-report');
const { create: createReporter } = require('istanbul-reports');

/**
 * @typedef {Object} TestResult
 * @property {Number} exitCode The exit code of the test.
 * @property {Number} failed Failed tests count.
 * @property {Object} coverage The coverage map result.
 */

/**
 * An abstract test runner.
 */
class TestRunner extends EventEmitter {
    static get START_EVENT() { return 'start'; }
    static get PREPARE_START_EVENT() { return 'preparestart'; }
    static get PREPARE_END_EVENT() { return 'prepareend'; }
    static get END_EVENT() { return 'end'; }
    static get STOP_EVENT() { return 'stop'; }

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
     * @private
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
        this.testDir = options.root.directory('__generated__');
        this.coverageDir = options.root.directory('__coverage__');
        this.options = Object.assign({}, options);
        this.resources = [];
    }

    /**
     * Run the tests.
     * @param {File[]} files A list of spec files.
     * @return {Promise<TestResult>}
     */
    async run(/* files */) {
        if (this.runId && !this.result) {
            await this.stop();
        }
        delete this.result;
        this.runId = this.runId || 0;
        this.runId++;

        this.testDir.ensure();
        this.testDir.empty();
        this.coverageMap = createCoverageMap({});

        return {
            id: this.runId,
            exitCode: 1,
            coverage: this.coverageMap.toJSON(),
            failed: [],
        };
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
        this.emit(this.constructor.STOP_EVENT);
    }

    async reportCoverage(coverageReport, environment) {
        this.coverageMap.merge(coverageReport);
        const coverageMap = createCoverageMap(coverageReport);
        const remappedCoverageMap = await createSourceMapStore().transformCoverage(coverageMap);
        const reportDir = this.coverageDir.directory(environment);
        const context = createContext({
            dir: reportDir.path,
            watermarks: getDefaultWatermarks(),
            coverageMap: remappedCoverageMap,
        });
        createReporter('html').execute(context);
        createReporter('lcovonly').execute(context);
    }
}

module.exports = TestRunner;
