const { EventEmitter } = require('events');

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
        this.options = Object.assign({}, options);
    }

    /**
     * Run the tests.
     * @param {NavigatorFile[]} files A list of spec files.
     * @return {Promise<TestResult>}
     */
    async run(/* files */) {
        this.resources = [];
    }
}

module.exports = TestRunner;
