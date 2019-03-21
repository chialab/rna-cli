const Bundler = require('./Bundler');

/**
 * Simply copy an input file to output.
 */
class CopyBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        let { input, output } = options;
        if (!input) {
            throw `missing "input" option for ${this.name}`;
        }
        if (!output) {
            throw `missing "output" option for ${this.name}`;
        }

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);
        let input = this.options.get('input');
        if (!input.exists()) {
            throw `missing "input" file ${input.localPath} for ${this.name}`;
        }
        this.result = input;
        this.addResources(input.path);

        return this.result;
    }

    /**
     * @inheritdoc
     */
    async write() {
        let output = this.options.get('output');
        this.result.copy(output);
        return output;
    }
}

module.exports = CopyBundler;
