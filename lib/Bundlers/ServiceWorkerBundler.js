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
            throw 'missing "output" or "root" option';
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
    async build() {
        let input = this.options.get('input');
        if (input && input.exists()) {
            await super.build();
        }

        let logger = this.getLogger();

        try {
            logger.play('generating service worker...');

            let output = this.options.get('output');
            let root = this.options.get('root');

            if (!root) {
                root = output.directory;
            }
            if (!output) {
                output = root.file('service-worker.js');
            }

            let exclude = [
                'service-worker.js',
                '*.map',
                ...(this.options.get('exclude') || []),
            ];

            if (output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let result;
            if (input.exists()) {
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

            logger.stop();

            let { size, zipped } = output.size;
            logger.info(output.localPath, `${size}, ${zipped} zipped`);
            logger.success('service worker ready');

            return result;
        } catch (error) {
            logger.stop();
            throw error;
        }
    }
}

module.exports = ServiceWorkerBundler;
