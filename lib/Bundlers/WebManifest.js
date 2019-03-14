const { existsSync, ensureFile, writeFile, readFile } = require('fs-extra');
const { join, relative, resolve, dirname } = require('path');
const { EventEmitter } = require('events');
const IconGenerator = require('./IconGenerator');

const MANIFEST_ICONS = {
    ANDROID_CHROME_36x36: {
        name: 'android-chrome-36x36.png',
        size: 36,
        type: 'icon',
    },
    ANDROID_CHROME_48x48: {
        name: 'android-chrome-48x48.png',
        size: 48,
        type: 'icon',
    },
    ANDROID_CHROME_72x72: {
        name: 'android-chrome-72x72.png',
        size: 72,
        type: 'icon',
    },
    ANDROID_CHROME_96x96: {
        name: 'android-chrome-96x96.png',
        size: 96,
        type: 'icon',
    },
    ANDROID_CHROME_144x144: {
        name: 'android-chrome-144x144.png',
        size: 144,
        type: 'icon',
    },
    ANDROID_CHROME_192x192: {
        name: 'android-chrome-192x192.png',
        size: 192,
        type: 'icon',
    },
    ANDROID_CHROME_256x256: {
        name: 'android-chrome-256x256.png',
        size: 256,
        type: 'icon',
    },
    ANDROID_CHROME_384x384: {
        name: 'android-chrome-384x384.png',
        size: 384,
        type: 'icon',
    },
    ANDROID_CHROME_512x512: {
        name: 'android-chrome-512x512.png',
        size: 512,
        type: 'icon',
    },
};

function getOutputIconFile(input, output, iconSource, name) {
    let iconRelative = relative(dirname(input), iconSource);
    return join(resolve(dirname(output), dirname(iconRelative)), name);
}

class WebManifest extends EventEmitter {
    /**
     * Create a web manifest bundler instance.
     * @param {WebManifestOptions} options A set of options for the web manifest bundler.
     */
    constructor(options = {}) {
        super();
        this.options = Object.assign({}, options);
        this.resources = [];
    }

    /**
     * A list of resources used by the bundler.
     * @type {Array<string>}
     */
    get files() {
        return this.resources.slice(0);
    }

    /**
     * Build the web manifest file and all its resources.
     * @return {Promise<void>}
     */
    async build() {
        let { input, output } = this.options;
        if (!input) {
            throw 'missing "input" option';
        }
        if (!output) {
            throw 'missing "output" option';
        }

        this.resources.push(input);

        let { name, description, scope, theme, icon, lang } = this.options;

        let manifest;
        if (!existsSync(input)) {
            manifest = {};
        } else {
            manifest = JSON.parse(await readFile(input, 'utf8'));
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
            this.resources.push(icon);

            this.iconGenerator = new IconGenerator({
                input: icon,
                output: Object.values(MANIFEST_ICONS).map(({ name, size, width, height, gutter, background, type }) => ({
                    file: getOutputIconFile(input, output, icon, name),
                    name,
                    size,
                    width,
                    height,
                    gutter,
                    background,
                    type,
                })),
            });

            await this.iconGenerator.build();
            manifest.icons = Object.values(MANIFEST_ICONS).map(({ size, name }) => (
                {
                    name: relative(dirname(output), getOutputIconFile(input, output, icon, name)),
                    sizes: `${size}x${size}`,
                    type: 'image/png',
                }
            ));
        }

        for (let key in manifest) {
            if (!manifest[key]) {
                delete manifest[key];
            }
        }

        return this.result = manifest;
    }

    /**
     * Write bundle results.
     * @return {Promise<void>}
     */
    async write() {
        let { output } = this.options;
        if (!output) {
            throw 'missing "output" option';
        }

        if (this.iconGenerator) {
            await this.iconGenerator.write();
        }

        await ensureFile(output);
        await writeFile(output, JSON.stringify(this.result, null, 2));
    }
}

module.exports = WebManifest;
