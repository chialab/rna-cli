/**
 * Collect info about bundles.
 */
class BundleManifest {
    /**
     * Construct a BundleManifest
     * @param {string} name The hash for the bundle.
     * @param {string} type The bundle generator (rollip/fusebox/sass...)
     */
    constructor(name, type) {
        this.name = name;
        this.type = type;
        this.files = [];
    }

    addFile(...files) {
        this.files.push(...files);
    }

    hasFile(file) {
        return !!this.files.find((f) => f === file);
    }
}

module.exports = BundleManifest;
