const { NavigatorFile } = require('../Navigator');
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
            options.input = input = new NavigatorFile(input);
        }
        if (typeof output === 'string') {
            options.output = output = new NavigatorFile(output);
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
            throw new Error(`missing "input" file ${input.localPath} for ${this.name}`);
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
        this.emit(CopyBundler.WRITE_EVENT, output);
        return output;
    }
}

module.exports = CopyBundler;
