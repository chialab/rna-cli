const { existsSync, readFileSync } = require('fs');
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

        if (output && !output.extname) {
            this.options.set('output', output.file(input.name));
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
        let progress = this.options.get('progress');
        let isFragment = this.result ? this.result.isFragment : true;
        profile.start();

        try {
            let icons = this.options.get('icons') || this.constructor.ICONS;

            this.addResources(input.path);

            let document;
            let invalidating = !this.result || invalidate.includes(input.path);
            if (invalidating) {
                if (progress) {
                    logger.play('html...', input.localPath);
                }

                let html = input.read();
                isFragment = !html.match(/<\/html>/i);
                document = new JSDOM(html, {
                    url: `file:///${input.path}`,
                    referrer: `file:///${input.path}`,
                }).window.document;

                if (this.options.get('links') !== false) {
                    this.linksBundlers = [];
                    await this.handleLinks(document);
                }
                if (this.options.get('styles') !== false) {
                    this.stylesBundlers = await this.handleStyles(document);
                }
                if (this.options.get('scripts') !== false) {
                    this.scriptsBundlers = [];
                    await this.handleScripts(document);
                }
                if (this.options.get('sources') !== false) {
                    this.sourcesBundlers = await this.handleSources(document);
                }
                if (this.options.get('webmanifest') !== false) {
                    this.webmanifestBundler = await this.handleWebManifest(document, this.options.get('webmanifest'), this.options.get('icon'));
                }
                if (this.options.get('icon') !== false) {
                    this.iconBundler = await this.handleIcon(document, icons, this.options.get('icon'));
                }
            } else {
                document = this.result.document;
            }

            if (invalidating) {
                profile.end();

                if (progress) {
                    logger.stop();
                    logger.success('html ready');
                }
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
                this.serviceWorkerBundler = await this.handleServiceWorker(document);
            }

            this.result = {
                document,
                isFragment,
                code: isFragment ? document.head.innerHTML + document.body.innerHTML  : document.documentElement.outerHTML,
            };
            return this.result;
        } catch (error) {
            if (progress) {
                logger.stop();
            }
            profile.end();
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
                    ['.css', '.sass', '.scss'].indexOf(input.extname) !== -1
                ) {
                    // css file
                    const callback = this.options.get('handleStyleLink');
                    element.setAttribute('type', 'text/css');
                    element.href = await ((callback && callback(input, root, element, document, 'style')) || this.handleStyleLink(input, root, element, document));
                } else if (
                    type === 'text/javascript' ||
                    type === 'application/javascript' ||
                    ['.js', '.jsx', '.mjs', '.ts', '.tsx'].indexOf(input.extname) !== -1
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
        let bundler = new StyleBundler(this.app, this.project);
        await bundler.setup({
            input,
            output,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map'),
            progress: false,
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
        let bundler = new ScriptBundler(this.app, this.project);
        await bundler.setup({
            input,
            output,
            bundle: true,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map'),
            polyfill: this.options.get('polyfill'),
            progress: false,
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
        let bundler = new CopyBundler(this.app, this.project);
        await bundler.setup({
            input,
            output,
            progress: false,
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
     * @return {Array<ScriptBundler|CopyBundler>} A list of bundlers.
     */
    async handleSources(document) {
        let elements = [...document.querySelectorAll('[src]:not(script)')]
            .filter((element) => !!element.src)
            .filter((element) => element.src.startsWith(dirname(document.baseURI)));
        return (await Promise.all(
            elements.map(async (element) => {
                let href = element.getAttribute('src');
                let input = this.options.get('input').parent.file(href);
                let output = this.options.get('output').parent.file(href);
                let bundler  = new CopyBundler(this.app, this.project);
                await bundler.setup({
                    input,
                    output,
                    progress: false,
                });
                await bundler.build();
                element.src = this.options.get('output').parent.relative(output);
                this.addResources(...bundler.files);
                return bundler;
            })
        ));
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
                    progress: false,
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
        const callback = this.options.get('handleScript');

        let input = this.options.get('input');
        let root = input.parent;
        let elements = [...document.querySelectorAll('script:not([data-serviceworker])')];
        let scriptModules = elements.filter((element) => element.getAttribute('type') === 'module');
        let scripts = elements.filter((element) => element.getAttribute('type') !== 'module');
        await Promise.all(
            scripts.map(async (element) => {
                element.setAttribute('type', 'text/javascript');
                if (element.src) {
                    let href = element.getAttribute('src');
                    let inputFile = root.file(href);
                    element.src = await ((callback && callback(inputFile, root, element, document, 'file')) || this.handleScriptFile(inputFile, root, element, document));
                    return;
                }
                element.textContent = await ((callback && callback(element.textContent, root, element, document, 'code')) || this.handleScriptCode(element.textContent, root, element, document));
            })
        );

        if (scriptModules.length) {
            let withSrc = scriptModules.filter((script) => script.hasAttribute('src'));
            let withoutSrc = scriptModules.filter((script) => !script.hasAttribute('src'));
            let code = withSrc.map((script) => `import '${script.src.replace('file://', '')}'`).join('\n');
            code += withoutSrc.map((script) => script.textContent).join('\n');

            scriptModules.forEach((script) => {
                script.parentNode.removeChild(script);
            });

            let elements = await ((callback && callback(code, scriptModules, document, 'module')) || this.handleScriptModules(code, root, scriptModules, document));
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
        let bundler = new ScriptBundler(this.app, this.project);
        await bundler.setup({
            input,
            output: outputFile,
            targets: this.options.get('targets'),
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map') ? 'inline' : false,
            polyfill: this.options.get('polyfill') ? 'inline' : false,
            lint: this.options.get('lint'),
            progress: false,
        });
        await bundler.build();
        this.scriptsBundlers.push(bundler);
        return outputRoot.relative(outputFile);
    }

    async handleScriptCode(code, root) {
        let bundler = new ScriptBundler(this.app, this.project);
        await bundler.setup({
            code,
            root,
            targets: this.options.get('targets'),
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map') ? 'inline' : false,
            polyfill: this.options.get('polyfill') ? 'inline' : false,
            lint: this.options.get('lint'),
            progress: false,
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
        let systemUrl = require.resolve('systemjs/dist/system.min.js', {
            paths: [__dirname],
        });
        let outputRoot = this.options.get('output').parent;
        let systemOutput = outputRoot.file('system.min.js');
        systemOutput.write(readFileSync(systemUrl, 'utf8'));
        let systemScript = document.system = document.createElement('script');
        systemScript.src = outputRoot.relative(systemOutput);
        systemScript.setAttribute('type', 'text/javascript');
        systemScript.setAttribute('nomodule', '');
        document.head.appendChild(systemScript);

        let esmOutput = outputRoot.directory('module');
        let umdOutput = outputRoot.directory('nomodule');

        let esmBundler = new ScriptBundler(this.app, this.project);
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
            progress: false,
        });

        await esmBundler.build();
        let primary = document.createElement('script');
        primary.src = outputRoot.relative(esmOutput.file(scriptInput.name));
        primary.setAttribute('type', 'module');
        this.addResources(...esmBundler.files);

        let registerBundler = new ScriptBundler(this.app, this.project);
        await registerBundler.setup({
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
            progress: false,
        });
        await registerBundler.build();
        let legacy = document.createElement('script');
        legacy.textContent = `System.import('./${outputRoot.relative(umdOutput.file(scriptInput.name))}')`;
        legacy.setAttribute('type', 'text/javascript');
        legacy.setAttribute('nomodule', '');

        this.scriptsBundlers.push(esmBundler, registerBundler);
        return [primary, legacy];
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
            progress: false,
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
            progress: false,
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
            progress: false,
        });
        if (!script.textContent.trim()) {
            script.parentNode.removeChild(script);
        }
        return bundler;
    }

    /**
     * @inheritdoc
     */
    async write() {
        let progress = this.options.get('progress');
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

        if (this.serviceWorkerBundler) {
            await this.serviceWorkerBundler.build();
            await this.serviceWorkerBundler.write();
        }

        if (progress) {
            let logger = this.getLogger();
            let { size, zipped } = output.size;
            logger.info(output.localPath, `${size}, ${zipped} zipped`);
        }
    }
}

module.exports = HTMLBundler;
