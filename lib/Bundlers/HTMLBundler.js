const Bundler = require('./Bundler');
const { JSDOM } = require('jsdom');
const { html: beautify } = require('js-beautify');
const StyleBundler = require('./StyleBundler');
const ScriptBundler = require('./ScriptBundler');
const WebManifestBundler = require('./WebManifestBundler');
const IconBundler = require('./IconBundler');
const ServiceWorkerBundler = require('./ServiceWorkerBundler');

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
            throw `missing "input" option for ${this.name}`;
        }
        if (!output) {
            throw `missing "output" option for ${this.name}`;
        }

        if (!output.extname) {
            this.options.set('output', output.file(input.basename));
        }
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        let input = this.options.get('input');
        if (!input.exists()) {
            throw `missing "input" file ${input.localPath} for ${this.name}`;
        }

        let profile = this.getProfiler();
        let logger = this.getLogger();
        profile.start();

        try {
            let output = this.options.get('output');
            let icons = this.options.get('icons') || this.constructor.ICONS;

            this.addResources(input.path);

            let document;
            let invalidating = !this.result || invalidate.includes(input.path);
            if (invalidating) {
                logger.play('html...', input.localPath);

                let html = input.read();
                document = new JSDOM(html, {
                    url: `file:///${input}`,
                    referrer: `file:///${input}`,
                }).window.document;

                if (this.options.get('styles') !== false) {
                    this.styleBundlers = await this.handleStyles(document);
                }
                if (this.options.get('scripts') !== false) {
                    this.scriptBundlers = await this.handleScripts(document);
                }
                if (this.options.get('webmanifest') !== false) {
                    this.webmanifestBundler = await this.handleWebManifest(document, this.options.get('webmanifest'), this.options.get('icon'));
                }
                if (this.options.get('icon') !== false) {
                    this.iconBundler = await this.handleIcon(document, icons, this.options.get('icon'));
                }
            } else {
                document = this.result;
            }

            if (invalidating) {
                let outHtml = beautify(document.documentElement.outerHTML, {
                    indent_size: 4,
                    indent_char: ' ',
                    preserve_newlines: false,
                });

                output.write(`<!DOCTYPE html>\n${outHtml}`);
                profile.end();
                let { size, zipped } = output.size;
                logger.info(output.localPath, `${size}, ${zipped} zipped`);
                logger.success('html ready');
            } else {
                // check resource bundles invalidation.
                await Promise.all(
                    (this.styleBundlers || []).map(async (bundler) => {
                        if (bundler.files.some((file) => invalidate.includes(file))) {
                            invalidating = true;
                            await bundler.build();
                        }
                        this.addResources(...bundler.files);
                    })
                );

                await Promise.all(
                    (this.scriptBundlers || []).map(async (bundler) => {
                        if (bundler.files.some((file) => invalidate.includes(file))) {
                            invalidating = true;
                            await bundler.build();
                        }
                        this.addResources(...bundler.files);
                    })
                );

                if (this.iconBundler) {
                    if (this.iconBundler.files.some((file) => invalidate.includes(file))) {
                        invalidating = true;
                        await this.iconBundler.build();
                    }
                    this.addResources(...this.iconBundler.files);
                }

                if (this.webmanifestBundler) {
                    if (this.webmanifestBundler.files.some((file) => invalidate.includes(file))) {
                        invalidating = true;
                        await this.webmanifestBundler.build();
                    }
                    this.addResources(...this.webmanifestBundler.files);
                }
            }

            if (this.options.get('serviceWorker') !== false && invalidating) {
                await this.handleServiceWorker(document);
            }

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
                link.href = this.options.get('output').directory.relative(output);
                link.setAttribute('type', 'text/css');
                let config = {
                    input,
                    output,
                };
                let bundler = new StyleBundler(this.app, this.project);
                await bundler.setup(config);
                await bundler.build();
                this.addResources(...bundler.files);
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
                script.src = this.options.get('output').directory.relative(output);
                script.setAttribute('type', 'text/javascript');
                let bundler = new ScriptBundler(this.app, this.project);
                await bundler.setup({
                    input,
                    output,
                    targets: this.options.get('targets'),
                    production: this.options.get('production'),
                    map: this.options.get('map'),
                });
                await bundler.build();
                this.addResources(...bundler.files);
                return bundler;
            })
        );
    }

    /**
     * Handle <link rel="icon"> element when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @param {Array<import('./IconBundler').IconDefinition>} definitions A list of icon definitions.
     * @param {NavigatorFile} [iconFile] An icon file.
     * @return {IconBundler} An icon generator.
     */
    async handleIcon(document, definitions, iconFile) {
        let iconLink = document.querySelector('link[rel="icon"]');
        if (!iconLink && !iconFile) {
            return;
        }

        let input = this.options.get('input');
        let output = this.options.get('output');

        let iconSource = iconFile ? iconFile : input.directory.file(iconLink.getAttribute('href'));
        let iconsOutput = output.directory.file(input.directory.relative(iconSource)).directory;
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
        let generated = await bundler.build();
        this.addResources(...bundler.files);
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
                if (icon.size === 48 && !document.querySelector('link[rel="shortcut icon"]')) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'shortcut icon');
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
        return bundler;
    }

    /**
     * Handle <link rel="manifest"> element when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @param {NavigatorFile} [manifestFile] A fallback manifest file.
     * @param {NavigatorFile} [iconFile] A fallback icon file.
     * @return {WebManifestBundler} A manifest bundler.
     */
    async handleWebManifest(document, manifestFile, iconFile) {
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink && !manifestFile) {
            return;
        }
        let descriptionElement = document.querySelector('meta[name="description"]');
        let baseElement = document.querySelector('base');
        let themeElement = document.querySelector('meta[name="theme"]');
        let iconElement = document.querySelector('link[rel="icon"]');
        let input = this.options.get('input');
        let output = this.options.get('output');
        let manifestInput = manifestFile ? manifestFile : input.directory.file(manifestLink.getAttribute('href'));
        let manifestOutput = manifestFile ? manifestFile : output.directory.file(manifestLink.getAttribute('href'));
        let iconSource = iconFile ? iconFile : input.directory.file(iconElement.getAttribute('href'));
        let bundler = new WebManifestBundler(this.app, this.project);
        await bundler.setup({
            input: manifestInput,
            output: manifestOutput,
            name: document.title,
            description: descriptionElement ? descriptionElement.content : '',
            scope: baseElement ? baseElement.getAttribute('href') : '',
            theme: themeElement ? themeElement.content : '',
            icon: iconSource,
            lang: document.documentElement.lang,
        });
        await bundler.build();
        this.addResources(...bundler.files);
        let manifest = bundler.result;
        if (manifest.name) {
            if (!document.querySelector('title')) {
                let titleElement = document.createElement('title');
                document.head.appendChild(titleElement);
                titleElement.textContent = manifest.name;
            }
            if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
                let metaElement = document.createElement('meta');
                document.head.appendChild(metaElement);
                metaElement.setAttribute('name', 'apple-mobile-web-app-title');
                metaElement.setAttribute('content', manifest.name);
            }
        }
        if (manifest.description) {
            if (!document.querySelector('meta[name="description"]')) {
                let metaElement = document.createElement('meta');
                document.head.appendChild(metaElement);
                metaElement.setAttribute('name', 'description');
                metaElement.setAttribute('content', manifest.description);
            }
        }
        if (manifest.scope) {
            if (!baseElement) {
                baseElement = document.createElement('base');
                document.head.appendChild(baseElement);
            }
            baseElement.setAttribute('href', manifest.scope);
        }
        if (manifest.theme_color) {
            if (!document.querySelector('meta[name="theme"]')) {
                let metaElement = document.createElement('meta');
                document.head.appendChild(metaElement);
                metaElement.setAttribute('name', 'theme');
                metaElement.setAttribute('content', manifest.theme_color);
            }
        }
        if (manifest.lang) {
            if (!document.documentElement.hasAttribute('lang')) {
                document.documentElement.setAttribute('lang', manifest.lang);
            }
        }
        if (!manifestLink) {
            manifestLink = document.createElement('link');
            document.head.appendChild(manifestLink);
            manifestLink.setAttribute('rel', 'manifest');
            manifestLink.setAttribute('href', input.directory.relative(manifestOutput));
        }
        return bundler;
    }

    /**
     * Handle <script data-serviceworker> element when bundling html files.
     * @private
     * @param {Document} document The main document instance.
     * @return {ServiceWorkerBundler} A service worker bundler.
     */
    async handleServiceWorker(document) {
        let script = document.querySelector('script[data-serviceworker]');
        if (!script) {
            return;
        }
        let href = script.getAttribute('data-serviceworker');
        let input = this.options.get('input').directory.file(href);
        let output = this.options.get('output').directory.file(href);
        let bundler = new ServiceWorkerBundler(this.app, this.project);
        await bundler.setup({
            input,
            output,
            root: output.directory,
            production: this.options.get('production'),
            map: this.options.get('map'),
        });
        if (!script.textContent.trim()) {
            script.parentNode.removeChild(script);
        }
        await bundler.build();
        return bundler;
    }
}

module.exports = HTMLBundler;
