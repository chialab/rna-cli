const targetsParser = require('@babel/preset-env/lib/targets-parser').default;
const { isPluginRequired } = require('@babel/preset-env/lib/index');

/**
 * Handle scripts and css targets.
 * @property {Object} targets A set of targeted browsers (key => browser name, value => min browser version).
 */
class Targets {
    /**
     * Transform a Browserlist query or a Babel present env query to a Targets entry.
     * @param {string|string[]|Object} targets Input targets.
     * @return {Targets}
     */
    static parse(targets) {
        if (targets === 'esmodules') {
            targets = targetsParser({ esmodules: true });
        } else if (targets === 'node') {
            targets = targetsParser({ node: true });
        } else if (typeof targets === 'string' || Array.isArray(targets)) {
            targets = targetsParser({ browsers: targets });
        } else if (typeof targets === 'object') {
            targets = targetsParser({ browsers: Object.keys(targets).map(browser => `${browser} ${targets[browser]}`).join(', ') });
        }

        return new Targets(targets);
    }

    /**
     * Create a Targets entry.
     * @param {Object} targets A set of targeted browsers (key => browser name, value => min browser version).
     */
    constructor(targets) {
        this.targets = targets;
    }

    /**
     * Check if targets matches the minimum required targets of a feature.
     * @param {Targets} supportTargets The minimum target of a feature.
     * @return {boolean}
     */
    check(supportTargets) {
        return !isPluginRequired(this.toObject(), supportTargets.toObject());
    }

    /**
     * Transform targets to a browser list query.
     * @return {string}
     */
    toQuery() {
        return Object.keys(this.toObject()).map(browser => `${browser} ${this.targets[browser].replace(/(\.0)*$/, '')}`).join(', ');
    }

    /**
     * Return a clone of the Targets set.
     * @return {Object}
     */
    toObject() {
        return Object.assign({}, this.targets);
    }
}

module.exports = Targets;
