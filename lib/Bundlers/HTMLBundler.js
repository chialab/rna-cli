const Bundler = require('./Bundler');
const { JSDOM } = require('jsdom');
const { html: beautify } = require('js-beautify');
const StyleBundler = require('./StyleBundler');
const ScriptBundler = require('./ScriptBundler');
const WebManifestBundler = require('./WebManifestBundler');
const IconBundler = require('./IconBundler');

/**
 * Bundle a HTML file and all its resources.
 */
class HTMLBundler extends Bundler {
    /**
     * The default set of icons for the HTML document.
     * @type {Array<import('./IconBundler').IconDefinition>}
     */
    static get ICONS() {
        return [
            {
                name: 'favicon-16x16.png',
                size: 16,
                type: 'icon',
            },
            {
                name: 'favicon-32x32.png',
                size: 32,
                type: 'icon',
            },
            {
                name: 'favicon-192x192.png',
                size: 192,
                type: 'icon',
            },
            {
                name: 'favicon-48x48.png',
                size: 48,
                type: 'icon',
            },
            {
                name: 'apple-touch-icon.png',
                size: 180,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                gutter: 30,
                type: 'icon',
            },
            {
                name: 'apple-touch-icon-ipad.png',
                size: 167,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                gutter: 30,
                type: 'icon',
            },
            {
                name: 'apple-launch-iphonex.png',
                width: 1125,
                height: 2436,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
                type: 'splash',
            },
            {
                name: 'apple-launch-iphone8.png',
                width: 750,
                height: 1334,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-iphone8-plus.png',
                width: 1242,
                height: 2208,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
                type: 'splash',
            },
            {
                name: 'apple-launch-iphone5.png',
                width: 640,
                height: 1136,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-ipadair.png',
                width: 1536,
                height: 2048,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-ipadpro10.png',
                width: 1668,
                height: 2224,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-ipadpro12.png',
                width: 2048,
                height: 2732,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                query: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
        ];
    }

    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        await super.setup(options);

        let { input, output } = options;
        if (!input) {
            throw 'missing "input" option';
        }
        if (!output) {
            throw 'missing "output" option';
        }

        if (!output.extname) {
            this.options.set('output', output.file(input.basename));
        }
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        if (invalidate.length) {
            // @todo perform rebuild
        } else if (this.result) {
            return this.result;
        }
        let input = this.options.get('input');
        if (!input.exists()) {
            throw 'missing "input" file';
        }

        let profile = this.getProfiler();
        let logger = this.getLogger();
        try {
            let output = this.options.get('output');

            logger.play('html...', input.localPath);

            this.addResources(input.path);

            let html = input.read();
            let document = this.result = new JSDOM(html, {
                url: `file:///${input}`,
                referrer: `file:///${input}`,
            }).window.document;

            let icons = this.options.get('icons') || this.constructor.ICONS;

            let styleBundles = await this.handleStyles(document);
            let scriptBundles = await this.handleScripts(document);
            let iconBundle = await this.handleIcon(document, icons);
            let manifestBundle = await this.handleWebManifest(document);

            await Promise.all(
                styleBundles.map((bundle) => bundle.build())
            );
            await Promise.all(
                scriptBundles.map((bundle) => bundle.build())
            );
            if (iconBundle) {
                await iconBundle.build();
            }
            if (manifestBundle) {
                await manifestBundle.build();
            }


            if (iconBundle) {
                this.setIcons(document, icons, iconBundle.result);
            }

            if (manifestBundle) {
                let manifest = manifestBundle.result;
                if (manifest.name) {
                    this.setTitle(document, manifest.name);
                }
                if (manifest.description) {
                    this.setDescription(document, manifest.description);
                }
                if (manifest.scope) {
                    this.setBase(document, manifest.scope);
                }
                if (manifest.theme_color) {
                    this.setTheme(document, manifest.theme_color);
                }
                if (manifest.lang) {
                    this.setLang(document, manifest.lang);
                }
            }

            let outHtml = beautify(this.result.documentElement.outerHTML, {
                indent_size: 4,
                indent_char: ' ',
                preserve_newlines: false,
            });

            output.write(`<!DOCTYPE html>\n${outHtml}`);
            profile.end();
            let { size, zipped } = output.size;
            logger.info(output.localPath, `${size}, ${zipped} zipped`);
            logger.success('html ready');

            return this.result = document;
        } catch (error) {
            logger.stop();
            profile.end();
            throw error;
        }
    }

    /**
     * Handle <link rel="stylesheets"> elements when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Array<StyleBundler>} A list of css bundlers.
     */
    async handleStyles(document) {
        let links = [...document.querySelectorAll('link[rel="stylesheet"]')];
        return await Promise.all(
            links.map(async (link) => {
                let href = link.getAttribute('href');
                let input = this.options.get('input').directory.file(href);
                let output = this.options.get('output').directory.file(href);
                output.changeExtension('.css');
                link.href = this.options.get('output').relative(output);
                link.setAttribute('type', 'text/css');
                let config = {
                    input,
                    output,
                };
                let bundler = new StyleBundler(this.app, this.project);
                await bundler.setup(config);
                return bundler;
            })
        );
    }

    /**
     * Handle <script src="..."> elements when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Array<ScriptBundler>} A list of Rollup bundlers.
     */
    async handleScripts(document) {
        let scripts = [...document.querySelectorAll('script[src]:not([type="module"])')];
        return await Promise.all(
            scripts.map(async (script) => {
                let href = script.getAttribute('src');
                let input = this.options.get('input').directory.file(href);
                let output = this.options.get('output').directory.file(href);
                output.changeExtension('.js');
                script.src = this.options.get('output').relative(output);
                script.setAttribute('type', 'text/javascript');
                let bundler = new ScriptBundler(this.app, this.project);
                await bundler.setup({
                    input,
                    output,
                });
                return bundler;
            })
        );
    }

    /**
     * Handle <link rel="icon"> element when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @param {Array<import('./IconBundler').IconDefinition>} definitions A list of icon definitions.
     * @return {IconBundler} An icon generator.
     */
    async handleIcon(document, definitions) {
        let iconLink = document.querySelector('link[rel="icon"]');
        if (!iconLink) {
            return;
        }

        let iconSource = this.options.get('input').directory.file(iconLink.getAttribute('href'));
        let iconsOutput = this.options.get('output').directory.file(iconLink.getAttribute('href')).directory;
        this.addResources(iconSource.path);

        let bundler = new IconBundler(this.app, this.project);
        await bundler.setup({
            input: iconSource,
            output: definitions.map(({ name, size, width, height, gutter, background, type }) => (
                {
                    file: iconsOutput.file(name),
                    name,
                    size,
                    width,
                    height,
                    gutter,
                    background,
                    type,
                }
            )),
        });
        return bundler;
    }

    /**
     * Handle <link rel="manifest"> element when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @return {WebManifestBundler} A manifest bundler.
     */
    async handleWebManifest(document) {
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            return;
        }
        let descriptionElement = document.querySelector('meta[name="description"]');
        let baseElement = document.querySelector('base');
        let themeElement = document.querySelector('meta[name="theme"]');
        let iconElement = document.querySelector('link[rel="icon"]');
        let href = manifestLink.getAttribute('href');
        let input = this.options.get('input').directory.file(href);
        let output = this.options.get('output').directory.file(href);
        let iconSource = iconElement ? this.options.get('input').directory.file(iconElement.getAttribute('href')) : null;
        let bundler = new WebManifestBundler(this.app, this.project);
        await bundler.setup({
            input,
            output,
            name: document.title,
            description: descriptionElement ? descriptionElement.content : '',
            scope: baseElement ? baseElement.getAttribute('href') : '',
            theme: themeElement ? themeElement.content : '',
            icon: iconSource,
            lang: document.documentElement.lang,
        });
        return bundler;
    }

    /**
     * Update title metadatas in the document.
     * @private
     * @param {Document} document The document to update.
     * @param {string} title The title to use.
     * @return {void}
     */
    setTitle(document, title) {
        if (!document.querySelector('title')) {
            let titleElement = document.createElement('title');
            document.head.appendChild(titleElement);
            titleElement.innerText = title;
        }
        if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
            let metaElement = document.createElement('meta');
            document.head.appendChild(metaElement);
            metaElement.setAttribute('name', 'apple-mobile-web-app-title');
            metaElement.setAttribute('content', title);
        }
    }

    /**
     * Update description metadata in the document.
     * @private
     * @param {Document} document The document to update.
     * @param {string} description The description to use.
     * @return {void}
     */
    setDescription(document, description) {
        if (!document.querySelector('meta[name="description"]')) {
            let metaElement = document.createElement('meta');
            document.head.appendChild(metaElement);
            metaElement.setAttribute('name', 'description');
            metaElement.setAttribute('content', description);
        }
    }

    /**
     * Update the base tag in the document.
     * @private
     * @param {Document} document The document to update.
     * @param {string} baseHref The base url to use.
     * @return {void}
     */
    setBase(document, baseHref) {
        if (!document.querySelector('base')) {
            let baseElement = document.createElement('base');
            document.head.appendChild(baseElement);
            baseElement.setAttribute('href', baseHref);
        }
    }

    /**
     * Update the theme metadata tag in the document.
     * @private
     * @param {Document} document The document to update.
     * @param {string} theme The theme color to use.
     * @return {void}
     */
    setTheme(document, theme) {
        if (!document.querySelector('meta[name="theme"]')) {
            let metaElement = document.createElement('meta');
            document.head.appendChild(metaElement);
            metaElement.setAttribute('name', 'theme');
            metaElement.setAttribute('content', theme);
        }
    }

    /**
     * Update the document language.
     * @private
     * @param {Document} document The document to update.
     * @param {string} lang The lang to use.
     * @return {void}
     */
    setLang(document, lang) {
        if (!document.documentElement.hasAttribute('lang')) {
            document.documentElement.setAttribute('lang', lang);
        }
    }

    /**
     * Inject icons into the document.
     * @private
     * @param {Document} document The document to update.
     * @param {Array<import('./IconBundler').IconDefinition>} definitions A list of icon definitions.
     * @param {Array<import('./IconBundler').IconResult>} generated A list of IconBundler results.
     * @return {void}
     */
    setIcons(document, definitions, generated) {
        definitions.forEach((definition) => {
            let icon = generated.find(({ name }) => name === definition.name);
            if (!icon) {
                return;
            }
            let href = this.options.get('output').directory.relative(icon.file);
            if (icon.name.startsWith('favicon')) {
                if (!document.querySelector(`link[rel="icon"][sizes="${icon.size}x${icon.size}"]`)) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'icon');
                    link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                    link.setAttribute('href', href);
                    document.head.appendChild(link);
                }
            } else if (icon.name.startsWith('apple-touch')) {
                if (!document.querySelector('link[rel="apple-touch-icon"]:not([sizes])')) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'apple-touch-icon');
                    link.setAttribute('href', href);
                    document.head.appendChild(link);
                }
                if (!document.querySelector(`link[rel="apple-touch-icon"][sizes="${icon.size}x${icon.size}"]`)) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'apple-touch-icon');
                    link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                    link.setAttribute('href', href);
                    document.head.appendChild(link);
                }
            } else if (icon.name.startsWith('apple-launch')) {
                if (!document.querySelector(`link[rel="apple-touch-startup-image"][media="${definition.query}"]`)) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'apple-touch-startup-image');
                    link.setAttribute('media', definition.query);
                    link.setAttribute('href', href);
                    document.head.appendChild(link);
                }
            }
        });
    }
}

module.exports = HTMLBundler;
