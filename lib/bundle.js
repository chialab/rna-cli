/**
 * Collect info about bundles.
 */
class BundleManifest {
    /**
     * Construct a BundleManifest
     * @param {string} input The input file of the bundle.
     * @param {string} output The output file of the bundle.
     */
    constructor(input, output) {
        this.input = input;
        this.output = output;
        this.files = [this.input];
    }
    /**
     * Add bundle dependencies.
     * @param {Array<string>} files
     */
    addFile(...files) {
        files.forEach((f) => {
            if (this.files.indexOf(f) === -1) {
                this.files.push(f);
            }
        });
    }
    /**
     * Check if bundle has a dependency.
     * @param {string} file The dependency path.
     */
    hasFile(file) {
        return !!this.files.find((f) => f === file);
    }
}

module.exports = BundleManifest;
