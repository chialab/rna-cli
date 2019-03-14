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
        let { input, output } = options;
        if (!input) {
            throw 'missing "input" option';
        }
        if (!output) {
            throw 'missing "output" option';
        }

        await super.setup(options);

        if (!output.extname) {
            this.options.set('output', output.file(input.basename));
        }
    }

    /**
     * @inheritdoc
     */
    async build() {
        let input = this.options.get('input');
        let output = this.options.get('output');
        let name = this.options.get('name');
        let description = this.options.get('description');
        let scope = this.options.get('scope');
        let theme = this.options.get('theme');
        let icon = this.options.get('icon');
        let lang = this.options.get('lang');
        let icons = this.options.get('icons') || this.constructor.icons;

        this.addResources(input.path);

        if (icon) {
            this.addResources(icon);
        }

        let logger = this.getLogger();
        logger.play('generating webmanifest...', input.localPath);

        let manifest;
        if (!input.exists()) {
            manifest = {};
        } else {
            manifest = input.readJson();
        }

        manifest.name = manifest.name || name;
        manifest.short_name = manifest.short_name || manifest.name;
        manifest.description = manifest.description || description;
        manifest.start_url = manifest.start_url || '/';
        manifest.scope = manifest.scope || scope || '/';
        manifest.display = manifest.display || 'standalone';
        manifest.orientation = manifest.orientation || 'any';
        manifest.theme_color = manifest.theme_color || theme;
        manifest.background_color = manifest.background_color || '#fff';
        manifest.lang = manifest.lang || lang || 'en-US';

        if (icon && !manifest.icons) {
            this.addResources(icon);

            let iconBundler = new IconBundler(this.app, this.project);
            await iconBundler.setup({
                input: icon,
                output: icons.map(({ name, size, width, height, gutter, background, type }) => {
                    let iconRelative = this.options.get('input').directory.relative(icon.path);
                    let iconOutput = this.options.get('output').directory.file(iconRelative);
                    iconOutput.rename(name);
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

            let generated = await iconBundler.build();
            manifest.icons = icons.map(({ size, name }) => {
                let icon = generated.find((i) => i.name === name);
                return {
                    name: this.options.get('output').directory.relative(icon.file),
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

        output.writeJson(manifest);
        let { size, zipped } = output.size;
        logger.info(output.localPath, `${size}, ${zipped} zipped`);
        logger.success('webmanifest ready');

        return this.result = manifest;
    }
}

module.exports = WebManifestBundler;
