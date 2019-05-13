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
        if (!options.output && !options.root) {
            throw `missing "output" or "root" option for ${this.name}`;
        }
        if (options.input) {
            await super.setup(options);
            this.options.set('targets', ['chrome 60']);
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

        let logger = this.getLogger();
        let progress = this.options.get('progress');

        try {
            if (progress) {
                logger.play('generating service worker...');
            }

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

            let tmpFile = this.app.store.tmpfile('output-sw.js');
            if (output && output.exists()) {
                let content = output.read();
                if (content.match(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/i)) {
                    let tmpInput = this.app.store.tmpfile('input-sw.js');
                    tmpInput.write(content.replace(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/gi, '.$1([])'));
                    await injectManifest({
                        swSrc: tmpInput.path,
                        swDest: tmpFile.path,
                        globDirectory: root.path,
                        globPatterns: ['**/*'],
                        globIgnores: exclude,
                        maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                    });
                }
            } else {
                await generateSW({
                    globDirectory: root.path,
                    swDest: tmpFile.path,
                    globPatterns: ['**/*'],
                    globIgnores: exclude,
                    maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                });
            }

            if (progress) {
                logger.stop();
                logger.success('service worker ready');
            }

            return this.result = {
                code: tmpFile.read(),
            };
        } catch (error) {
            if (progress) {
                logger.stop();
            }
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        let progress = this.options.get('progress');
        let output = this.options.get('output');
        output.write(this.result.code);
        if (progress) {
            let logger = this.getLogger();
            let { size, zipped } = output.size;
            logger.info(output.localPath, `${size}, ${zipped} zipped`);
        }
    }
}

module.exports = ServiceWorkerBundler;
