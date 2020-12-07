const { EventEmitter } = require('events');
const colors = require('colors/safe');
const Linter = require('../Linters/Linter');
const { prettyBytes } = require('../File');
const { promises: { realpath, stat } } = require('fs');

/**
 * A bundler base class.
 */
class Bundler extends EventEmitter {
    static get BUILD_START_EVENT() { return 'buildstart'; }
    static get BUILD_PROGRESS_EVENT() { return 'buildprogress'; }
    static get BUILD_END_EVENT() { return 'buildend'; }
    static get BUNDLE_START_EVENT() { return 'bundlestart'; }
    static get BUNDLE_END_EVENT() { return 'bundleend'; }
    static get WRITE_START_EVENT() { return 'writestart'; }
    static get WRITE_PROGRESS_EVENT() { return 'writeprogress'; }
    static get WRITE_END_EVENT() { return 'writeend'; }
    static get ERROR_EVENT() { return 'error'; }
    static get WARN_EVENT() { return 'warn'; }
    static get LINT_EVENT() { return 'lintresult'; }
    static get ANALYSIS_EVENT() { return 'analysis'; }

    /**
     * Formatter for bundle analysis.
     * @param {Array} analysis Analysis data.
     * @return {string}
     */
    static formatBundleAnalysis(analysis) {
        let lengths = analysis.modules.map((m) => m.id.length);
        let maxLength = Math.max(...lengths) + 1;
        let lines = [];

        analysis.modules.forEach((m) => {
            let size = prettyBytes(m.size);
            lines.push(`${m.id.padEnd(maxLength, ' ')} ${m.reduction == 100 ? colors.red('removed by threeshake') : `${m.percent.toFixed(2).padStart(5, ' ')}% | ${colors.yellow(size.padStart(9, ' '))}${m.reduction > 0 ? colors.green(` (-${m.reduction}%)`) : ''}`}`);
        });

        return `\n${lines.join('\n')}\n`;
    }

    /**
     * Create a bundler instance.
     */
    constructor() {
        super();
        this.options = {};
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
     * @param {...Array<string>} resources A list of resources to add.
     * @return {Promise<void>void}
     */
    async addResources(...resources) {
        let res = this.resources;
        await Promise.all(
            resources.map(async (file) => {
                try {
                    await stat(file);
                    file = await realpath(file);
                    if (res.indexOf(file) === -1) {
                        res.push(file);
                    }
                } catch (err) {
                    // file does not exists
                }
            })
        );
    }

    /**
     * Setup the bundler.
     * @param {Object} options The options of the build.
     * @return {void}
     */
    async setup(options = {}) {
        Object.assign(this.options, options);
        this.resources = [];
    }

    /**
     * Exec a build for the project.
     * @param {...Array<string>} invalidate A list of files to invalidate.
     * @return {Promise}
     */
    async build() {
        this.written = false;
        this.linter.reset();
    }

    /**
     * Write bundle results.
     * @return {Promise}
     */
    async write() {
        this.written = true;
    }

    async toPromise(write = true) {
        await this.build();

        if (write) {
            await this.write();
        }
    }

    listenBundler(bundler) {
        bundler.on(Bundler.BUILD_START_EVENT, (input, code, child) => this.emit(Bundler.BUILD_START_EVENT, input, code, child || bundler));
        bundler.on(Bundler.BUILD_PROGRESS_EVENT, (output, child) => this.emit(Bundler.BUILD_PROGRESS_EVENT, output, child || bundler));
        bundler.on(Bundler.BUILD_END_EVENT, (input, code, child) => this.emit(Bundler.BUILD_END_EVENT, input, code, child || bundler));
        bundler.on(Bundler.WRITE_START_EVENT, (child) => this.emit(Bundler.WRITE_START_EVENT, child || bundler));
        bundler.on(Bundler.WRITE_PROGRESS_EVENT, (output, child) => this.emit(Bundler.WRITE_PROGRESS_EVENT, output, child || bundler));
        bundler.on(Bundler.WRITE_END_EVENT, (child) => this.emit(Bundler.WRITE_END_EVENT, child || bundler));
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
