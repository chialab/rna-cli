const { File } = require('../File');
const Bundler = require('./Bundler');

/**
 * Simply copy an input file to output.
 */
class CopyBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        options = Object.assign({}, options);

        let { input, output } = options;
        if (!input) {
            throw new Error(`missing "input" option for ${this.name}`);
        }
        if (!output) {
            throw new Error(`missing "output" option for ${this.name}`);
        }

        if (typeof input === 'string') {
            options.input = input = new File(input);
        }
        if (typeof output === 'string') {
            options.output = output = new File(output);
        }

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);
        const input = this.options.input;
        this.emit(CopyBundler.BUNDLE_START, input);
        if (!input.exists()) {
            throw new Error(`missing "input" file ${input.localPath} for ${this.name}`);
        }
        this.result = input;
        this.addResources(input.path);
        this.emit(CopyBundler.BUNDLE_END, this.result);
        return this.result;
    }

    /**
     * @inheritdoc
     */
    async write() {
        const output = this.options.output;
        this.emit(CopyBundler.WRITE_START);
        this.result.copy(output);
        this.emit(CopyBundler.WRITE_PROGRESS, output);
        this.emit(CopyBundler.WRITE_END);
        await super.write();
        return output;
    }
}

module.exports = CopyBundler;
