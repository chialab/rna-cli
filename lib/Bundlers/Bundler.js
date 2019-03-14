const { EventEmitter } = require('events');

/**
 * A bundler base class.
 */
class Bundler extends EventEmitter {
    /**
     * Create a bundler instance.
     * @param {CLI} app The process instance.
     * @param {Project} project The project of the build.
     */
    constructor(app, project) {
        super();
        this.app = app;
        this.project = project;
        this.options = new Map();
    }

    getProfiler() {
        return this.app.profiler.task(this.constructor.name);
    }

    getLogger() {
        return this.app.logger;
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
}

module.exports = Bundler;
