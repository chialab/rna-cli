const { EventEmitter } = require('events');

/**
 * @typedef {Object} TestResult
 * @property {Number} exitCode The exit code of the test.
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

    /**
     * Add runner environments.
     * @param {...Array<string>} environments A list of environments to add.
     * @return {void}
     */
    addEnvironments(...environments) {
        environments.forEach((env) => {
            if (this.environments.indexOf(env) === -1) {
                this.environments.push(env);
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
        this.environments = [];
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
     * @return {Promise<TestResult>}
     */
    async run() {
        if (this.runId && !this.result) {
            await this.stop();
        }
        delete this.result;
        this.runId = this.runId || 0;
        this.runId++;

        return {
            id: this.runId,
            exitCode: 1,
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
}

module.exports = TestRunner;
