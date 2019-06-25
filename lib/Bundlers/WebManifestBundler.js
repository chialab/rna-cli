const { File } = require('../File');
const Bundler = require('./Bundler');
const IconBundler = require('./IconBundler');

class WebManifestBundler extends Bundler {
    /**
     * A list of manifest icons.
     * @type {Array<import('./IconBundler').IconDefinition>}
     */
    static get icons() {
        return [
            {
                name: 'android-chrome-36x36.png',
                size: 36,
                type: 'icon',
            },
            {
                name: 'android-chrome-48x48.png',
                size: 48,
                type: 'icon',
            },
            {
                name: 'android-chrome-72x72.png',
                size: 72,
                type: 'icon',
            },
            {
                name: 'android-chrome-96x96.png',
                size: 96,
                type: 'icon',
            },
            {
                name: 'android-chrome-144x144.png',
                size: 144,
                type: 'icon',
            },
            {
                name: 'android-chrome-192x192.png',
                size: 192,
                type: 'icon',
            },
            {
                name: 'android-chrome-256x256.png',
                size: 256,
                type: 'icon',
            },
            {
                name: 'android-chrome-384x384.png',
                size: 384,
                type: 'icon',
            },
            {
                name: 'android-chrome-512x512.png',
                size: 512,
                type: 'icon',
            },
        ];
    }

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
        if (!output.extname) {
            options.output = output = output.file(input.name);
        }

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        let input = this.options.get('input');
        let name = this.options.get('name');
        let description = this.options.get('description');
        let scope = this.options.get('scope');
        let theme = this.options.get('theme');
        let icon = this.options.get('icon');
        let lang = this.options.get('lang');
        let icons = this.options.get('icons') || this.constructor.icons;
        let override = this.options.get('override');

        this.emit(WebManifestBundler.BUNDLE_START, input);

        this.addResources(input.path);

        if (icon) {
            this.addResources(icon);
        }

        try {
            this.emit(WebManifestBundler.BUILD_START, input, null);

            let manifest;
            if (!input.exists()) {
                manifest = {};
            } else {
                manifest = input.readJson();
            }

            manifest.name = (override && name) || manifest.name || name;
            manifest.short_name = manifest.short_name || manifest.name;
            manifest.description = (override && description) || manifest.description || description;
            manifest.start_url = manifest.start_url || '/';
            manifest.scope = (override && scope) || manifest.scope || scope || '/';
            manifest.display = manifest.display || 'standalone';
            manifest.orientation = manifest.orientation || 'any';
            manifest.theme_color = (override && theme) || manifest.theme_color || theme;
            manifest.background_color = manifest.background_color || '#fff';
            manifest.lang = (override && lang) || manifest.lang || lang || 'en-US';

            if (icon && !manifest.icons) {
                this.addResources(icon);

                this.iconBundler = new IconBundler();
                this.listenBundler(this.iconBundler);
                await this.iconBundler.setup({
                    input: icon,
                    output: icons.map(({ name, size, width, height, gutter, background, type }) => {
                        let iconRelative = this.options.get('input').parent.relative(icon.path);
                        let iconOutput = this.options.get('output').parent.file(iconRelative).rename(name, false);
                        return {
                            file: iconOutput,
                            name,
                            size,
                            width,
                            height,
                            gutter,
                            background,
                            type,
                        };
                    }),
                });

                let generated = await this.iconBundler.build();
                manifest.icons = icons.map(({ size, name }) => {
                    let icon = generated.find((i) => i.name === name);
                    return {
                        name: this.options.get('output').parent.relative(icon.file),
                        sizes: `${size}x${size}`,
                        type: 'image/png',
                    };
                });
            }

            for (let key in manifest) {
                if (!manifest[key]) {
                    delete manifest[key];
                }
            }

            this.result = manifest;

            this.emit(WebManifestBundler.BUILD_END, input, null);
            this.emit(WebManifestBundler.BUNDLE_END, this.result);

            return this.result;
        } catch (error) {
            this.emit(WebManifestBundler.ERROR_EVENT, error);
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        let output = this.options.get('output');

        this.emit(WebManifestBundler.WRITE_START);

        if (this.iconBundler) {
            await this.iconBundler.write();
        }
        output.writeJson(this.result);
        this.emit(WebManifestBundler.WRITE_PROGRESS, output);

        this.emit(WebManifestBundler.WRITE_END);
        return output;
    }
}

module.exports = WebManifestBundler;
