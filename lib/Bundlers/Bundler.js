const { EventEmitter } = require('events');

/**
 * A bundler base class.
 */
class Bundler extends EventEmitter {
    static get START_EVENT() { return 'start'; }
    static get END_EVENT() { return 'end'; }
    static get WRITE_EVENT() { return 'write'; }
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
    }

    /**
     * Exec a build for the project.
     * @param {...Array<string>} invalidate A list of files to invalidate.
     * @return {Promise}
     */
    async build() {
        this.resources = [];
    }

    /**
     * Write bundle results.
     * @return {Promise}
     */
    async write() {
        return null;
    }

    listenBundler(bundler) {
        bundler.on(Bundler.START_EVENT, (input, code, invalidate, child) => this.emit(Bundler.START_EVENT, input, code, invalidate, child || bundler));
        bundler.on(Bundler.END_EVENT, (child) => this.emit(Bundler.END_EVENT, child || bundler));
        bundler.on(Bundler.ERROR_EVENT, (error, child) => this.emit(Bundler.ERROR_EVENT, error, child || bundler));
        bundler.on(Bundler.WRITE_EVENT, (output, child) => this.emit(Bundler.WRITE_EVENT, output, child || bundler));
        bundler.on(Bundler.WARN_EVENT, (message, child) => this.emit(Bundler.WARN_EVENT, message, child || bundler));
        bundler.on(Bundler.LINT_EVENT, (result, child) => this.emit(Bundler.LINT_EVENT, result, child || bundler));
        bundler.on(Bundler.ANALYSIS_EVENT, (result, child) => this.emit(Bundler.ANALYSIS_EVENT, result, child || bundler));
    }
}

module.exports = Bundler;
