/**
 * Collect info about bundles.
 */
class Bundle {
    /**
     * Construct a Bundle
     * @param {string} input The input file of the bundle.
     * @param {string} output The output file of the bundle.
     * @param {string} code The bundle code.
     * @param {Object} map The source map of the bundle.
     * @param {Object} ast The ast of the bundle.
     */
    constructor(input, output) {
        this.input = input;
        this.output = output;
    }

    /**
     * The bundle result code.
     * @type {string}
     */
    get code() {
        return null;
    }

    /**
     * The bundle result map.
     * @type {Object}
     */
    get map() {
        return null;
    }

    /**
     * The bundle result ast.
     * @type {Object}
     */
    get ast() {
        return null;
    }

    /**
     * The list of files involved in the bundle.
     * @type {Array<string>}
     */
    get files() {
        return [];
    }
}

module.exports = Bundle;
