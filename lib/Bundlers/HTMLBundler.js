const { existsSync, readFileSync } = require('fs');
const { dirname, extname } = require('path');
const { File, Directory } = require('../File');
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
        options = Object.assign({}, options);

        let { input, output, root } = options;

        if (!input) {
            throw new Error(`missing "input" option for ${this.name}`);
        }

        if (typeof input === 'string') {
            options.input = input = new File(input);
        }
        if (typeof output === 'string') {
            if (extname(options.output)) {
                options.output = output = new File(output);
            } else {
                options.output = output = new Directory(output).file(input.name);
            }
        } else if (output && !output.extname) {
            options.output = output = output.file(input.name);
        }

        if (typeof root === 'string') {
            options.root = root = new Directory(root);
        }

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        let input = this.options.get('input');
        if (!input.exists()) {
            throw new Error(`missing "input" file ${input.localPath} for ${this.name}`);
        }

        let fragment = this.options.get('fragment');

        try {
            let icons = this.options.get('icons') || this.constructor.ICONS;

            this.addResources(input.path);

            let document;
            let invalidating = !this.result || invalidate.includes(input.path);
            if (invalidating) {
                this.emit(HTMLBundler.START_EVENT, input, null, invalidate);

                let html = input.read();
                document = new JSDOM(html, {
                    url: `file:///${input.path}`,
                    referrer: `file:///${input.path}`,
                }).window.document;

                let description = this.options.get('description');
                if (description && !document.querySelector('meta[name="description"]')) {
                    let metaDesc = document.createElement('meta');
                    metaDesc.setAttribute('name', 'description');
                    metaDesc.setAttribute('content', description);
                    document.head.prepend(metaDesc);
                }

                let title = this.options.get('title');
                if (title && !document.querySelector('title')) {
                    let titleElem = document.createElement('title');
                    titleElem.textContent = title;
                    document.head.prepend(titleElem);
                }

                if (this.options.get('links') !== false) {
                    this.linksBundlers = [];
                    await this.handleLinks(document);
                }
                if (this.options.get('styles') !== false) {
                    this.stylesBundlers = [];
                    await this.handleStyles(document);
                }
                if (this.options.get('scripts') !== false) {
                    this.scriptsBundlers = [];
                    await this.handleScripts(document);
                }
                if (this.options.get('sources') !== false) {
                    this.sourcesBundlers = [];
                    await this.handleSources(document);
                }
                if (this.options.get('webmanifest') !== false && !fragment) {
                    this.webmanifestBundler = await this.handleWebManifest(document, this.options.get('webmanifest'), this.options.get('icon'));
                }
                if (this.options.get('icon') !== false && !fragment) {
                    this.iconBundler = await this.handleIcon(document, icons, this.options.get('icon'));
                }
            } else {
                document = this.result.document;
            }

            if (invalidating) {
                this.emit(HTMLBundler.END_EVENT);
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

            this.result = {
                document: fragment ? JSDOM.fragment(document.head.innerHTML + document.body.innerHTML) : document.documentElement,
                code: fragment ? document.head.innerHTML + document.body.innerHTML  : document.documentElement.outerHTML,
            };
            return this.result;
        } catch (error) {
            this.emit(HTMLBundler.ERROR_EVENT, error);
            throw error;
        }
    }

    /**
     * Handle elements with href attribute. Exec bundle on css and javascript files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of bundlers.
     */
    async handleLinks(document) {
        let elements = [...document.querySelectorAll('[href]')]
            .filter((element) => ['manifest', 'icon'].indexOf(element.getAttribute('rel')) === -1)
            .filter((element) => !!element.href)
            .filter((element) => element.href.startsWith(dirname(document.baseURI)))
            .filter((element) => extname(element.href))
            .filter((element) => existsSync(element.href.replace('file://', '')));

        let input = this.options.get('input');
        let root = input.parent;

        return await Promise.all(
            elements.map(async (element) => {
                let type = element.getAttribute('type');
                let href = element.getAttribute('href');
                let rel = element.getAttribute('rel');
                let input = this.options.get('input').parent.file(href);
                if (
                    type === 'text/css' ||
                    rel === 'stylesheet' ||
                    element.getAttribute('as') === 'style' ||
                    ['.css', '.sass', '.scss'].includes(input.extname)
                ) {
                    // css file
                    const callback = this.options.get('handleStyleLink');
                    element.setAttribute('type', 'text/css');
                    element.href = await ((callback && callback(input, root, element, document, 'style')) || this.handleStyleLink(input, root, element, document));
                } else if (
                    type === 'text/javascript' ||
                    type === 'application/javascript' ||
                    element.getAttribute('as') === 'script' ||
                    ['.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(input.extname)
                ) {
                    // javascript file
                    const callback = this.options.get('handleScriptLink');
                    element.setAttribute('type', 'text/javascript');
                    element.href = await ((callback && callback(input, root, element, document, 'script')) || this.handleScriptLink(input, root, element, document));
                } else {
                    const callback = this.options.get('handleAssetLink');
                    element.href = await ((callback && callback(input, root, element, document, 'asset')) || this.handleAssetLink(input, root, element, document));
                }
            })
        );
    }

    async handleStyleLink(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for link');
        }
        let href = element.getAttribute('href');
        let output = this.options.get('output').parent.file(href).ext('.css');
        let bundler = new StyleBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map'),
            handleCSSAsset: this.options.get('handleCSSAsset'),
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        this.addResources(...bundler.files);
        return this.options.get('output').parent.relative(output);
    }

    async handleScriptLink(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for link');
        }
        let href = element.getAttribute('href');
        let output = this.options.get('output').parent.file(href).ext('.js');
        let bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output,
            bundle: true,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map'),
            polyfill: this.options.get('polyfill'),
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        this.addResources(...bundler.files);
        return this.options.get('output').parent.relative(output);
    }

    async handleAssetLink(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for link');
        }
        let href = element.getAttribute('href');
        let output = this.options.get('output').parent.file(href);
        let bundler = new CopyBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output,
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        this.addResources(...bundler.files);
        return this.options.get('output').parent.relative(output);
    }

    /**
     * Handle elements with a source. Exec bundle on javascript files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of bundlers.
     */
    async handleSources(document) {
        let elements = [...document.querySelectorAll('[src]:not(script)')]
            .filter((element) => !!element.src)
            .filter((element) => element.src.startsWith(dirname(document.baseURI)));
        await Promise.all(
            elements.map(async (element) => {
                let href = element.getAttribute('src');
                let input = this.options.get('input').parent.file(href);
                let output = this.options.get('output').parent.file(href);
                let bundler = new CopyBundler();
                this.listenBundler(bundler);
                await bundler.setup({
                    input,
                    output,
                });
                await bundler.build();
                element.src = this.options.get('output').parent.relative(output);
                this.addResources(...bundler.files);
                this.sourcesBundlers.push(bundler);
            })
        );
    }

    /**
     * Handle <style> elements.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of style bundlers.
     */
    async handleStyles(document) {
        const callback = this.options.get('handleStyleCode');
        const input = this.options.get('input');
        const root = input.parent;
        let styleElements = [...document.querySelectorAll('style')];
        await Promise.all(
            styleElements.map(async (element) => {
                element.textContent = await ((callback && callback(element.textContent, root, element, document)) || this.handleStyleCode(element.textContent, root, element, document));
            })
        );

        let nodeElements = [...document.querySelectorAll('[style]')];
        await Promise.all(
            nodeElements.map(async (element) => {
                element.setAttribute('style', await ((callback && callback(element.textContent, root, element, document)) || this.handleStyleCode(element.textContent, root, element, document)));
            })
        );
    }

    async handleStyleCode(code, root) {
        const bundler = new StyleBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            code,
            root,
            output: this.options.get('output') && this.options.get('output').parent,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map') ? 'inline' : false,
            handleCSSAsset: this.options.get('handleCSSAsset'),
        });
        this.stylesBundlers.push(bundler);
        const { css } = await bundler.build();
        return css.toString();
    }

    /**
     * Handle <script> inline elements.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of style bundlers.
     */
    async handleScripts(document) {
        const input = this.options.get('input');
        const root = input.parent;
        const elements = [...document.querySelectorAll('script:not([data-serviceworker])')];
        const scriptModules = elements.filter((element) => element.getAttribute('type') === 'module');
        const scripts = elements.filter((element) => element.getAttribute('type') !== 'module');
        if (scripts.length) {
            await Promise.all(
                scripts.map(async (element) => {
                    element.setAttribute('type', 'text/javascript');
                    if (element.src) {
                        const callback = this.options.get('handleScriptFile');
                        let href = element.getAttribute('src');
                        let inputFile = root.file(href);
                        element.src = await ((callback && callback(inputFile, root, element, document)) || this.handleScriptFile(inputFile, root, element, document));
                        return;
                    }
                    const callback = this.options.get('handleScriptCode');
                    element.textContent = await ((callback && callback(element.textContent, root, element, document)) || this.handleScriptCode(element.textContent, root, element, document));
                })
            );
        }

        if (scriptModules.length) {
            const callback = this.options.get('handleScriptModules');
            let withSrc = scriptModules.filter((script) => script.hasAttribute('src'));
            let withoutSrc = scriptModules.filter((script) => !script.hasAttribute('src'));
            let code = withSrc.map((script) => `import '${script.src.replace('file://', '')}'`).join('\n');
            code += withoutSrc.map((script) => script.textContent).join('\n');

            scriptModules.forEach((script) => {
                script.parentNode.removeChild(script);
            });

            let elements = await ((callback && callback(code, root, scriptModules, document)) || this.handleScriptModules(code, root, scriptModules, document));
            elements.forEach((element) => {
                document.body.appendChild(element);
            });
        }
    }

    async handleScriptFile(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for script');
        }
        let href = element.getAttribute('src');
        let outputRoot = this.options.get('output').parent;
        let outputFile = outputRoot.file(href).ext('.js');
        let bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
            targets: this.options.get('targets'),
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map') ? 'inline' : false,
            polyfill: this.options.get('polyfill') ? 'inline' : false,
            lint: this.options.get('lint'),
        });
        await bundler.build();
        this.scriptsBundlers.push(bundler);
        return outputRoot.relative(outputFile);
    }

    async handleScriptCode(code, root) {
        let bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            code,
            root,
            targets: this.options.get('targets'),
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map') ? 'inline' : false,
            polyfill: this.options.get('polyfill') ? 'inline' : false,
            lint: this.options.get('lint'),
        });
        let result = await bundler.build();
        this.scriptsBundlers.push(bundler);
        return result.code;
    }

    async handleScriptModules(code, root, elements, document) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for script');
        }
        let input = this.options.get('input');
        let scriptInput = input.parent.file(`${input.basename}.m.js`);
        let outputRoot = this.options.get('output').parent;

        let esmOutput = outputRoot.directory('module');
        let umdOutput = outputRoot.directory('nomodule');

        let esmBundler = new ScriptBundler();
        this.listenBundler(esmBundler);
        await esmBundler.setup({
            code,
            root,
            input: scriptInput,
            output: esmOutput,
            format: 'esm',
            targets: this.options.get('targets'),
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map'),
            polyfill: this.options.get('polyfill'),
            lint: this.options.get('lint'),
        });

        await esmBundler.build();
        let primary = document.createElement('script');
        primary.src = outputRoot.relative(esmOutput.file(scriptInput.name));
        primary.setAttribute('type', 'module');
        this.addResources(...esmBundler.files);

        let systemUrl = require.resolve('systemjs/dist/s.min.js', {
            paths: [__dirname],
        });
        let systemOutput = umdOutput.file('s.min.js');
        systemOutput.write(readFileSync(systemUrl, 'utf8'));
        let systemScript = document.system = document.createElement('script');
        systemScript.src = outputRoot.relative(systemOutput);
        systemScript.setAttribute('type', 'text/javascript');
        systemScript.setAttribute('nomodule', '');
        document.head.appendChild(systemScript);

        let systemBundler = new ScriptBundler();
        this.listenBundler(systemBundler);
        await systemBundler.setup({
            code,
            root,
            input: scriptInput,
            output: umdOutput,
            format: 'system',
            targets: this.options.get('targets'),
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map'),
            polyfill: this.options.get('polyfill'),
            lint: this.options.get('lint'),
        });
        await systemBundler.build();
        let legacy = document.createElement('script');
        legacy.textContent = `System.import('./${outputRoot.relative(umdOutput.file(scriptInput.name))}')`;
        legacy.setAttribute('type', 'text/javascript');
        legacy.setAttribute('nomodule', '');

        this.scriptsBundlers.push(esmBundler, systemBundler);
        return [primary, legacy];
    }

    /**
     * Handle <link rel="icon"> element.
     * @private
     * @param {Document} document The main document instance.
     * @param {Array<import('./IconBundler').IconDefinition>} definitions A list of icon definitions.
     * @param {File} [iconFile] An icon file.
     * @return {IconBundler} An icon generator.
     */
    async handleIcon(document, definitions, iconFile) {
        let iconLink = document.querySelector('link[rel*="icon"]');
        if (!iconLink && !iconFile) {
            return;
        }

        let input = this.options.get('input');
        let output = this.options.get('output');

        let iconSource = iconFile ? iconFile : input.parent.file(iconLink.getAttribute('href'));
        let iconsOutput = output.parent.file(input.parent.relative(iconSource)).parent;
        this.addResources(iconSource.path);

        let bundler = new IconBundler();
        this.listenBundler(bundler);
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
     * @param {File} [manifestFile] A fallback manifest file.
     * @param {File} [iconFile] A fallback icon file.
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
        let iconElement = document.querySelector('link[rel*="icon"]');
        let input = this.options.get('input');
        let output = this.options.get('output');
        let manifestInput = manifestFile ? manifestFile : input.parent.file(manifestLink.getAttribute('href'));
        let manifestOutput = manifestFile ? manifestFile : output.parent.file(manifestLink.getAttribute('href'));
        let iconSource = iconFile ? iconFile : (iconElement && input.parent.file(iconElement.getAttribute('href')));
        let bundler = new WebManifestBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input: manifestInput,
            output: manifestOutput,
            name: document.title || this.options.get('title'),
            description: (descriptionElement && descriptionElement.content) || this.options.get('description') || '',
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
     * @inheritdoc
     */
    async write() {
        let output = this.options.get('output');
        let outHtml = beautify(this.result.code, {
            indent_size: 4,
            indent_char: ' ',
            preserve_newlines: false,
        });

        await Promise.all(
            (this.linksBundlers || [])
                .concat(this.stylesBundlers || [])
                .concat(this.scriptsBundlers || [])
                .concat(this.sourcesBundlers || [])
                .concat(this.iconBundler ? [this.iconBundler] : [])
                .concat(this.webmanifestBundler ? [this.webmanifestBundler] : [])
                .map(async (bundler) => {
                    await bundler.write();
                })
        );

        output.write(`<!DOCTYPE html>\n${outHtml}`);

        this.emit(CopyBundler.WRITE_EVENT, output);

        if (this.options.get('serviceWorker') !== false && this.webmanifestBundler) {
            let manifest = this.webmanifestBundler.result;
            if (manifest.serviceworker && manifest.serviceworker.src) {
                let inputSW = this.options.get('input').parent.file(manifest.serviceworker.src);
                let outputSW = this.options.get('output').parent.file(manifest.serviceworker.src);
                let bundlerSW = new ServiceWorkerBundler();
                this.listenBundler(bundlerSW);
                await bundlerSW.setup({
                    input: inputSW,
                    output: outputSW,
                    root: outputSW.parent,
                    production: this.options.get('production'),
                    map: this.options.get('map'),
                });
                await bundlerSW.build();
                await bundlerSW.write();
            }
        }

        return output;
    }
}

module.exports = HTMLBundler;
