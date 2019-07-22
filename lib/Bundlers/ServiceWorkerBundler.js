const path = require('path');
const { File, Directory } = require('../File');
const Bundler = require('./Bundler');
const ScriptBundler = require('./ScriptBundler');
const { injectManifest, generateSW } = require('workbox-build');

/**
 * Generate a service worker.
 */
class ServiceWorkerBundler extends ScriptBundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        options = Object.assign({}, options);

        let { input, output, root } = options;

        if (!output && !root) {
            throw new Error(`missing "output" or "root" option for ${this.name}`);
        }

        if (typeof input === 'string') {
            options.input = input = new File(input);
        }
        if (typeof output === 'string') {
            if (path.extname(options.output)) {
                options.output = output = new File(output);
            } else {
                options.output = output = new Directory(output);
            }
        }
        if (typeof root === 'string') {
            options.root = root = new Directory(root);
        }

        if (input) {
            options.targets = 'esmodules';
            await super.setup(options);
        } else {
            await Bundler.prototype.setup.call(this, options);
        }
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        let input = this.options.get('input');
        if (input && input.exists()) {
            await super.build(...invalidate);
        } else {
            await Bundler.prototype.build.call(this, ...invalidate);
        }

        this.emit(ServiceWorkerBundler.BUNDLE_START, input);
        this.emit(ServiceWorkerBundler.BUILD_START, input);

        try {
            let output = this.options.get('output');
            let root = this.options.get('root');

            if (!root) {
                root = output.parent;
            }
            if (!output) {
                output = root.file('service-worker.js');
            }

            let exclude = this.options.get('exclude') || [];
            if (!Array.isArray(exclude)) {
                exclude = [exclude];
            }
            exclude = exclude.concat([output.name, '*.map']);

            if (output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            if (output && output.exists()) {
                let content = output.read();
                if (content.match(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/i)) {
                    let tmpInput = output.ext('.temp.js');
                    tmpInput.write(content.replace(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/gi, '.$1([])'));
                    await injectManifest({
                        swSrc: tmpInput.path,
                        swDest: output.path,
                        globDirectory: root.path,
                        globPatterns: ['**/*'],
                        globIgnores: exclude,
                        maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                    });
                    tmpInput.unlink();
                }
            } else {
                await generateSW({
                    globDirectory: root.path,
                    swDest: output.path,
                    globPatterns: ['**/*'],
                    globIgnores: exclude,
                    maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                });
            }

            this.result = {
                code: output.read(),
            };

            this.emit(ServiceWorkerBundler.BUILD_END, input, null);
            this.emit(ServiceWorkerBundler.BUNDLE_END, this.result);

            return this.result;
        } catch (error) {
            this.emit(ServiceWorkerBundler.ERROR_EVENT, error);
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        let output = this.options.get('output');
        this.emit(ServiceWorkerBundler.WRITE_START);
        output.write(this.result.code);
        this.emit(ServiceWorkerBundler.WRITE_PROGRESS, output);
        this.emit(ServiceWorkerBundler.WRITE_END);
        return output;
    }
}

module.exports = ServiceWorkerBundler;
