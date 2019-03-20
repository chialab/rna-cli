const { existsSync } = require('fs');
const { dirname, extname } = require('path');
const Bundler = require('./Bundler');
const { JSDOM } = require('jsdom');
const { html: beautify } = require('js-beautify');
const CopyBundler = require('./CopyBundler');
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
                    url: `file:///${input.path}`,
                    referrer: `file:///${input.path}`,
                }).window.document;

                if (this.options.get('links') !== false) {
                    this.linksBundlers = await this.handleLinks(document);
                }
                if (this.options.get('sources') !== false) {
                    this.sourcesBundlers = await this.handleSources(document);
                }
                if (this.options.get('styles') !== false) {
                    this.stylesBundlers = await this.handleStyles(document);
                }
                if (this.options.get('scripts') !== false) {
                    this.scriptsBundlers = await this.handleScripts(document);
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
                    (this.linksBundlers || [])
                        .concat(this.sourcesBundlers || [])
                        .concat(this.stylesBundlers || [])
                        .concat(this.scriptsBundlers || [])
                        .concat(this.iconBundler ? [this.iconBundler] : [])
                        .concat(this.webmanifestBundler ? [this.webmanifestBundler] : [])
                        .map(async (bundler) => {
                            if (bundler.files.some((file) => invalidate.includes(file))) {
                                invalidating = true;
                                await bundler.build();
                            }
                            this.addResources(...bundler.files);
                        })
                );
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
     * Handle elements with href attribute. Exec bundle on css and javascript files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Array<StyleBundler|ScriptBundler|CopyBundler>} A list of bundlers.
     */
    async handleLinks(document) {
        let elements = [...document.querySelectorAll('[href]')]
            .filter((element) => ['manifest', 'icon'].indexOf(element.getAttribute('rel')) === -1)
            .filter((element) => !!element.href)
            .filter((element) => element.href.startsWith(dirname(document.baseURI)))
            .filter((element) => extname(element.href))
            .filter((element) => existsSync(element.href.replace('file://', '')));

        return await Promise.all(
            elements.map(async (element) => {
                let type = element.getAttribute('type');
                let href = element.getAttribute('href');
                let rel = element.getAttribute('rel');
                let input = this.options.get('input').parent.file(href);
                let output = this.options.get('output').parent.file(href);
                let bundler;
                if (
                    type === 'text/css' ||
                    rel === 'stylesheet' ||
                    ['.css', '.sass', '.scss'].indexOf(input.extname) !== -1
                ) {
                    // css file
                    output.changeExtension('.css');
                    element.setAttribute('type', 'text/css');
                    bundler = new StyleBundler(this.app, this.project);
                    await bundler.setup({
                        input,
                        output,
                        targets: this.options.get('targets'),
                        production: this.options.get('production'),
                        map: this.options.get('map'),
                    });
                } else if (
                    type === 'text/javascript' ||
                    type === 'application/javascript' ||
                    ['.js', '.jsx', '.mjs', '.ts', '.tsx'].indexOf(input.extname) !== -1
                ) {
                    // javascript file
                    output.changeExtension('.js');
                    element.setAttribute('type', 'text/javascript');
                    bundler = new ScriptBundler(this.app, this.project);
                    await bundler.setup({
                        input,
                        output,
                        targets: this.options.get('targets'),
                        production: this.options.get('production'),
                        map: this.options.get('map'),
                        polyfill: this.options.get('polyfill'),
                    });
                } else {
                    bundler = new CopyBundler(this.app, this.project);
                    await bundler.setup({
                        input,
                        output,
                    });
                }
                await bundler.build();
                element.href = this.options.get('output').parent.relative(output);
                this.addResources(...bundler.files);
                return bundler;
            })
        );
    }

    /**
     * Handle elements with a source. Exec bundle on javascript files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Array<ScriptBundler|CopyBundler>} A list of bundlers.
     */
    async handleSources(document) {
        let elements = [...document.querySelectorAll('[src]')]
            .filter((element) => !!element.src)
            .filter((element) => element.src.startsWith(dirname(document.baseURI)));
        return await Promise.all(
            elements.map(async (element) => {
                let type = element.getAttribute('type');
                let href = element.getAttribute('src');
                let input = this.options.get('input').parent.file(href);
                let output = this.options.get('output').parent.file(href);
                let bundler;
                if (
                    type === 'text/javascript' ||
                    type === 'application/javascript' ||
                    ['.js', '.jsx', '.mjs', '.ts', '.tsx'].indexOf(input.extname) !== -1
                ) {
                    // javascript file
                    output.changeExtension('.js');
                    element.setAttribute('type', 'text/javascript');
                    bundler = new ScriptBundler(this.app, this.project);
                    await bundler.setup({
                        input,
                        output,
                        targets: this.options.get('targets'),
                        production: this.options.get('production'),
                        map: this.options.get('map'),
                        polyfill: this.options.get('polyfill'),
                    });
                } else {
                    bundler = new CopyBundler(this.app, this.project);
                    await bundler.setup({
                        input,
                        output,
                    });
                }
                await bundler.build();
                element.src = this.options.get('output').parent.relative(output);
                this.addResources(...bundler.files);
                return bundler;
            })
        );
    }

    /**
     * Handle <style> elements.
     * @private
     * @param {Document} document The main document instance.
     * @return {Array<StyleBundler>} A list of style bundlers.
     */
    async handleStyles(document) {
        let elements = [...document.querySelectorAll('style')];
        return await Promise.all(
            elements.map(async (element) => {
                let css = element.textContent;
                let bundler = new StyleBundler(this.app, this.project);
                await bundler.setup({
                    code: css,
                    root: this.options.get('input').parent,
                    output: this.options.get('output').parent,
                    targets: this.options.get('targets'),
                    production: this.options.get('production'),
                    map: this.options.get('map') ? 'inline' : false,
                });
                let result = await bundler.build();
                element.textContent = result.css.toString();
                return bundler;
            })
        );
    }

    /**
     * Handle <script> inline elements.
     * @private
     * @param {Document} document The main document instance.
     * @return {Array<StyleBundler>} A list of style bundlers.
     */
    async handleScripts(document) {
        let elements = [...document.querySelectorAll('script:not([src])')];
        return await Promise.all(
            elements.map(async (element) => {
                let code = element.textContent;
                let bundler = new ScriptBundler(this.app, this.project);
                await bundler.setup({
                    code,
                    root: this.options.get('input').parent,
                    output: this.options.get('output').parent,
                    targets: this.options.get('targets'),
                    production: this.options.get('production'),
                    map: this.options.get('map') ? 'inline' : false,
                    polyfill: this.options.get('polyfill') ? 'inline' : false,
                });
                let result = await bundler.build();
                element.textContent = result.code;
                return bundler;
            })
        );
    }

    /**
     * Handle <link rel="icon"> element.
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

        let iconSource = iconFile ? iconFile : input.parent.file(iconLink.getAttribute('href'));
        let iconsOutput = output.parent.file(input.parent.relative(iconSource)).parent;
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
            let href = this.options.get('output').parent.relative(icon.file);
            if (icon.name.startsWith('favicon')) {
                if (!document.querySelector(`link[rel="icon"][sizes="${icon.size}x${icon.size}"]`)) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'icon');
                    link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                    link.setAttribute('href', href);
                    if (iconLink) {
                        iconLink.parentNode.insertBefore(link, iconLink);
                    } else {
                        document.head.appendChild(link);
                    }
                }
                if (icon.size === 48 && !document.querySelector('link[rel="shortcut icon"]')) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'shortcut icon');
                    link.setAttribute('href', href);
                    if (iconLink) {
                        iconLink.parentNode.insertBefore(link, iconLink);
                    } else {
                        document.head.appendChild(link);
                    }
                }
            } else if (icon.name.startsWith('apple-touch')) {
                if (!document.querySelector('link[rel="apple-touch-icon"]:not([sizes])')) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'apple-touch-icon');
                    link.setAttribute('href', href);
                    if (iconLink) {
                        iconLink.parentNode.insertBefore(link, iconLink);
                    } else {
                        document.head.appendChild(link);
                    }
                }
                if (!document.querySelector(`link[rel="apple-touch-icon"][sizes="${icon.size}x${icon.size}"]`)) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'apple-touch-icon');
                    link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                    link.setAttribute('href', href);
                    if (iconLink) {
                        iconLink.parentNode.insertBefore(link, iconLink);
                    } else {
                        document.head.appendChild(link);
                    }
                }
            } else if (icon.name.startsWith('apple-launch')) {
                if (!document.querySelector(`link[rel="apple-touch-startup-image"][media="${definition.query}"]`)) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'apple-touch-startup-image');
                    link.setAttribute('media', definition.query);
                    link.setAttribute('href', href);
                    if (iconLink) {
                        iconLink.parentNode.insertBefore(link, iconLink);
                    } else {
                        document.head.appendChild(link);
                    }
                }
            }
        });
        if (iconLink) {
            iconLink.parentNode.removeChild(iconLink);
        }
        return bundler;
    }

    /**
     * Handle <link rel="manifest"> element.
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
        let manifestInput = manifestFile ? manifestFile : input.parent.file(manifestLink.getAttribute('href'));
        let manifestOutput = manifestFile ? manifestFile : output.parent.file(manifestLink.getAttribute('href'));
        let iconSource = iconFile ? iconFile : input.parent.file(iconElement.getAttribute('href'));
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
            manifestLink.setAttribute('href', input.parent.relative(manifestOutput));
        }
        return bundler;
    }

    /**
     * Handle <script data-serviceworker> element.
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
        let input = this.options.get('input').parent.file(href);
        let output = this.options.get('output').parent.file(href);
        let bundler = new ServiceWorkerBundler(this.app, this.project);
        await bundler.setup({
            input,
            output,
            root: output.parent,
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
