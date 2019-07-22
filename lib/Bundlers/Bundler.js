const { EventEmitter } = require('events');
const Linter = require('../Linters/Linter.js');

/**
 * A bundler base class.
 */
class Bundler extends EventEmitter {
    static get BUILD_START() { return 'buildstart'; }
    static get BUILD_END() { return 'buildend'; }
    static get BUNDLE_START() { return 'bundlestart'; }
    static get BUNDLE_END() { return 'bundleend'; }
    static get WRITE_START() { return 'writestart'; }
    static get WRITE_PROGRESS() { return 'writeprogress'; }
    static get WRITE_END() { return 'writeend'; }
    static get ERROR_EVENT() { return 'error'; }
    static get WARN_EVENT() { return 'warn'; }
    static get LINT_EVENT() { return 'lintresult'; }
    static get ANALYSIS_EVENT() { return 'analysis'; }
    /**
     * Create a bundler instance.
     */
    constructor() {
        super();
        this.options = new Map();
        this.linter = new Linter();
    }

    /**
     * The bundler name.
     * @type {string}
     */
    get name() {
        return this.constructor.name;
    }

    /**
     * A list of resources used by the bundler.
     * @type {Array<string>}
     */
    get files() {
        return this.resources.slice(0);
    }

    /**
     * Add bundle resources.
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

    /**
     * Setup the bundler.
     * @param {Object} options The options of the build.
     * @return {void}
     */
    async setup(options = {}) {
        options = Object.assign({}, options);
        for (let k in options) {
            this.options.set(k, options[k]);
        }
        this.resources = [];
    }

    /**
     * Exec a build for the project.
     * @param {...Array<string>} invalidate A list of files to invalidate.
     * @return {Promise}
     */
    async build() {
        this.linter.reset();
    }

    /**
     * Write bundle results.
     * @return {Promise}
     */
    async write() {
        return null;
    }

    listenBundler(bundler) {
        bundler.on(Bundler.BUILD_START, (input, code, child) => this.emit(Bundler.BUILD_START, input, code, child || bundler));
        bundler.on(Bundler.BUILD_END, (input, code, child) => this.emit(Bundler.BUILD_END, input, code, child || bundler));
        bundler.on(Bundler.WRITE_START, (child) => this.emit(Bundler.WRITE_START, child || bundler));
        bundler.on(Bundler.WRITE_PROGRESS, (output, child) => this.emit(Bundler.WRITE_PROGRESS, output, child || bundler));
        bundler.on(Bundler.WRITE_END, (child) => this.emit(Bundler.WRITE_END, child || bundler));
        bundler.on(Bundler.ERROR_EVENT, (error, child) => this.emit(Bundler.ERROR_EVENT, error, child || bundler));
        bundler.on(Bundler.WARN_EVENT, (message, child) => this.emit(Bundler.WARN_EVENT, message, child || bundler));
        bundler.on(Bundler.LINT_EVENT, (result) => {
            this.linter.merge(result);
            this.emit(Bundler.LINT_EVENT, this.linter.result, bundler);
        });
        bundler.on(Bundler.ANALYSIS_EVENT, (result, child) => this.emit(Bundler.ANALYSIS_EVENT, result, child || bundler));
    }
}

module.exports = Bundler;
