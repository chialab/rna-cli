const { EventEmitter } = require('events');
const NYC = require('nyc');
const { createCoverageMap } = require('istanbul-lib-coverage');

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
    /**
     * Create a test runner instance.
     * @param {CLI} app The process instance.
     * @param {Project} project The project of the build.
     */
    constructor(app, project) {
        super();
        this.app = app;
        this.project = project;
    }

    /**
     * The runner name.
     * @type {string}
     */
    get name() {
        return this.constructor.name;
    }

    /**
     * Get a profiler task for the runner.
     * @return {Profiler}
     */
    getProfiler() {
        return this.app.profiler.task(this.name, false);
    }

    /**
     * Get the logger for the bundle.
     * @return {Logger}
     */
    getLogger() {
        return this.app.logger;
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
        let testDir = this.project.directories.test || this.project.directory('test');
        this.testDir = testDir.directory('__generated__');
        this.coverageDir = testDir.directory('__coverage__');
        this.options = Object.assign({}, options);
    }

    /**
     * Run the tests.
     * @param {NavigatorFile[]} files A list of spec files.
     * @return {Promise<TestResult>}
     */
    async run(/* files */) {
        this.resources = [];
        this.testDir.ensure();
        this.testDir.empty();
        this.coverageMap = createCoverageMap({});

        return {
            exitCode: 1,
            coverage: this.coverageMap.toJSON(),
            failed: [],
        };
    }

    reportCoverage(coverage, environment) {
        this.coverageMap.merge(coverage);
        global.__coverage__ = coverage;
        const reportDir = this.coverageDir.directory(environment);
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

module.exports = TestRunner;
