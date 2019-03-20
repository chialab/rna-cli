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
        let write = this.options.get('write');

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
            exclude = exclude.concat([output.basename, '*.map']);

            if (output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let result;
            if (output && output.exists()) {
                let content = output.read();
                if (content.match(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/i)) {
                    let tmpFile = this.app.store.tmpfile('sw.js');
                    tmpFile.write(content.replace(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/gi, '.$1([])'));
                    try {
                        result = await injectManifest({
                            swSrc: tmpFile.path,
                            swDest: output.path,
                            globDirectory: root.path,
                            globPatterns: ['**/*'],
                            globIgnores: exclude,
                            maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                        });
                    } catch (err) {
                        tmpFile.unlink();
                        throw err;
                    }
                } else {
                    result = content;
                }
            } else {
                result = await generateSW({
                    globDirectory: root.path,
                    swDest: output.path,
                    globPatterns: ['**/*'],
                    globIgnores: exclude,
                    maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                });
            }

            if (progress) {
                logger.stop();
            }

            if (write && progress) {
                let { size, zipped } = output.size;
                logger.info(output.localPath, `${size}, ${zipped} zipped`);
            }
            if (progress) {
                logger.success('service worker ready');
            }

            return result;
        } catch (error) {
            if (progress) {
                logger.stop();
            }
            throw error;
        }
    }
}

module.exports = ServiceWorkerBundler;
