const { readFileSync } = require('fs');
const { join, extname } = require('path');
const { JSDOM } = require('jsdom');
const babelData = require('@babel/preset-env/data/built-in-modules.json');
const { html: beautify } = require('js-beautify');
const { File, Directory } = require('../File');
const Bundler = require('./Bundler');
const Targets = require('../Targets');
const { isJSFile, isStyleFile } = require('../extensions');
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
                name: 'favicon-196x196.png',
                size: 196,
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

    get bundlers() {
        return (this.linksBundlers || [])
            .concat(this.sourcesBundlers || [])
            .concat(this.stylesBundlers || [])
            .concat(this.scriptsBundlers || [])
            .concat(this.iconBundler ? [this.iconBundler] : [])
            .concat(this.webmanifestBundler ? [this.webmanifestBundler] : []);
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

        this.emit(HTMLBundler.BUNDLE_START, input);

        try {
            let icons = this.options.get('icons') || this.constructor.ICONS;

            this.addResources(input.path);

            let document;
            let invalidating = !this.result || invalidate.includes(input.path);
            if (invalidating) {
                this.emit(HTMLBundler.BUILD_START, input, null);

                let html = input.read();
                document = new JSDOM(html, {
                    url: 'file:///index.html',
                    referrer: 'file:///index.html',
                }).window.document;

                if (document.querySelector('base')) {
                    this.base = document.querySelector('base').getAttribute('href');
                } else {
                    this.base = '';
                }

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

                if (this.options.get('webmanifest') !== false && !fragment) {
                    let bundler = await this.handleWebManifest(document, this.options.get('webmanifest'), this.options.get('icon'));
                    if (bundler) {
                        this.webmanifestBundler = bundler;
                    }
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
                if (this.options.get('icon') !== false && !fragment) {
                    let bundler = await this.handleIcon(document, icons, this.options.get('icon'));
                    if (bundler) {
                        this.iconBundler = bundler;
                    }
                }
            } else {
                document = this.result.document;
            }

            if (invalidating) {
                this.emit(HTMLBundler.BUILD_END, input, null);
            } else {
                // check resource bundles invalidation.
                await Promise.all(
                    this.bundlers
                        .map(async (bundler) => {
                            if (bundler.files.some((file) => invalidate.includes(file))) {
                                invalidating = true;
                                await bundler.build(...invalidate);
                            }
                            this.addResources(...bundler.files);
                        })
                );
            }

            this.result = {
                document,
                fragment: fragment ? JSDOM.fragment(document.head.innerHTML + document.body.innerHTML) : document.documentElement,
                code: fragment ? document.head.innerHTML + document.body.innerHTML  : document.documentElement.outerHTML,
            };

            this.emit(HTMLBundler.BUNDLE_END, this.result);

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
        let input = this.options.get('input');
        let root = input.parent;
        let elements = [...document.querySelectorAll('link[href], a[download][href], iframe[href]')]
            .filter((element) => !element.getAttribute('rel').match(/\b(manifest|icon)\b/i))
            .filter((element) => !!element.href)
            .filter((element) => element.href.startsWith('file://'))
            .filter((element) => root.file(element.href.replace('file:///', '')).exists());

        return await Promise.all(
            elements.map(async (element) => {
                const type = element.getAttribute('type');
                const rel = element.getAttribute('rel');
                const href = element.href.replace('file:///', '');
                const input = this.options.get('input').parent.file(href);
                if (
                    type === 'text/css' ||
                    rel === 'stylesheet' ||
                    element.getAttribute('as') === 'style' ||
                    isStyleFile(input.path)
                ) {
                    // css file
                    const callback = this.options.get('handleStyleLink');
                    element.setAttribute('type', 'text/css');
                    element.setAttribute('href', await ((callback && callback(input, root, element, document, 'style')) || this.handleStyleLink(input, root, element, document)));
                } else if (
                    type === 'text/javascript' ||
                    type === 'application/javascript' ||
                    element.getAttribute('as') === 'script' ||
                    isJSFile(input.path)
                ) {
                    // javascript file
                    const callback = this.options.get('handleScriptLink');
                    element.setAttribute('type', 'text/javascript');
                    element.setAttribute('href', await ((callback && callback(input, root, element, document, 'script')) || this.handleScriptLink(input, root, element, document)));
                } else {
                    const callback = this.options.get('handleAssetLink');
                    element.setAttribute('href', await ((callback && callback(input, root, element, document, 'asset')) || this.handleAssetLink(input, root, element, document)));
                }
            })
        );
    }

    async handleStyleLink(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for link');
        }
        const href = element.href.replace('file:///', '');
        const output = this.options.get('output').parent;
        const outputFile = output.file(href).ext('.css');
        const bundler = new StyleBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map'),
            lint: this.options.get('lint'),
            handleCSSAsset: this.options.get('handleCSSAsset'),
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        this.addResources(...bundler.files);
        return `${this.base.replace(/^\/*$/, '')}/${output.relative(outputFile)}`;
    }

    async handleScriptLink(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for link');
        }
        const href = element.href.replace('file:///', '');
        const output = this.options.get('output').parent;
        const outputFile = output.file(href).ext('.js');
        const bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
            bundle: true,
            targets: this.options.get('targets'),
            production: this.options.get('production'),
            map: this.options.get('map'),
            polyfill: this.options.get('polyfill'),
            jsx: this.options.get('jsx'),
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        this.addResources(...bundler.files);
        return `${this.base.replace(/^\/*$/, '')}/${output.relative(outputFile)}`;
    }

    async handleAssetLink(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for link');
        }
        const output = this.options.get('output');
        const outputRoot = output.parent;
        const href = element.href.replace('file:///', '');
        const outputFile = outputRoot.file(href);
        const bundler = new CopyBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        this.addResources(...bundler.files);
        return `${this.base.replace(/^\/*$/, '')}/${outputRoot.relative(output)}`;
    }

    /**
     * Handle elements with a source. Exec bundle on javascript files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of bundlers.
     */
    async handleSources(document) {
        const input = this.options.get('input');
        const root = input.parent;
        const output = this.options.get('output');
        const outputRoot = output.parent;
        const elements = [...document.querySelectorAll('[src]:not(script)')]
            .filter((element) => !!element.src)
            .filter((element) => element.src.startsWith('file://'));
        await Promise.all(
            elements.map(async (element) => {
                const href = element.src.replace('file:///', '');
                const inputFile = root.file(href);
                const outputFile = outputRoot.file(href);
                const bundler = new CopyBundler();
                this.listenBundler(bundler);
                await bundler.setup({
                    input: inputFile,
                    output: outputFile,
                });
                await bundler.build();
                element.setAttribute('src', `${this.base.replace(/^\/*$/, '')}/${outputRoot.relative(outputFile)}`);
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
        const styleElements = [...document.querySelectorAll('style')];
        await Promise.all(
            styleElements.map(async (element) => {
                element.textContent = await ((callback && callback(element.textContent, root, element, document)) || this.handleStyleCode(element.textContent, root, element, document));
            })
        );

        const nodeElements = [...document.querySelectorAll('[style]')];
        await Promise.all(
            nodeElements.map(async (element) => {
                element.setAttribute('style', await ((callback && callback(element.getAttribute('style'), root, element, document)) || this.handleStyleCode(element.getAttribute('style'), root, element, document)));
            })
        );
    }

    async handleStyleCode(code, root) {
        const bundler = new StyleBundler();
        const output = this.options.get('output');
        const outputRoot = output && output.parent;
        this.listenBundler(bundler);
        await bundler.setup({
            code,
            root,
            output: outputRoot,
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
                scripts
                    .filter((element) => !element.src || element.src.startsWith('file://'))
                    .map(async (element) => {
                        element.setAttribute('type', 'text/javascript');
                        if (element.src) {
                            const callback = this.options.get('handleScriptFile');
                            const href = element.src.replace('file:///', '');
                            const inputFile = root.file(href);
                            element.setAttribute('src', await ((callback && callback(inputFile, root, element, document)) || this.handleScriptFile(inputFile, root, element, document)));
                            return;
                        }
                        const callback = this.options.get('handleScriptCode');
                        element.textContent = await ((callback && callback(element.textContent, root, element, document)) || this.handleScriptCode(element.textContent, root, element, document));
                    })
            );
        }

        if (scriptModules.length) {
            const callback = this.options.get('handleScriptModules');
            const withSrc = scriptModules.filter((script) => script.hasAttribute('src'));
            const withoutSrc = scriptModules.filter((script) => !script.hasAttribute('src'));
            let code = withSrc.map((script) => `export * from './${root.relative(root.file(script.src.replace('file:///', '')))}'`).join('\n');
            code += withoutSrc.map((script) => script.textContent).join('\n');

            scriptModules.forEach((script) => {
                script.parentNode.removeChild(script);
            });

            const elements = await ((callback && callback(code, root, scriptModules, document)) || this.handleScriptModules(code, root, scriptModules, document));
            elements.forEach((element) => {
                document.body.appendChild(element);
            });
        }
    }

    async handleScriptFile(input, root, element) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for script');
        }
        const href = element.src.replace('file:///', '');
        const outputRoot = this.options.get('output').parent;
        const outputFile = outputRoot.file(href).ext('.js');
        const bundler = new ScriptBundler();
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
            jsx: this.options.get('jsx'),
        });
        await bundler.build();
        this.scriptsBundlers.push(bundler);
        return `${this.base.replace(/^\/*$/, '')}/${outputRoot.relative(outputFile)}`;
    }

    async handleScriptCode(code, root) {
        const bundler = new ScriptBundler();
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
            jsx: this.options.get('jsx'),
        });
        const result = await bundler.build();
        this.scriptsBundlers.push(bundler);
        return result.code;
    }

    async handleScriptModules(code, root, elements, document) {
        if (!this.options.get('output')) {
            throw new Error('missing output option for script');
        }
        const targets = Targets.parse(this.options.get('targets'));
        const supportTargets = Targets.parse(babelData['es6.module']);
        const supportModules = targets.check(supportTargets);

        const input = this.options.get('input');
        const scriptInput = input.parent.file(`${input.basename}.m.js`);
        const outputRoot = this.options.get('output').parent;
        const moduleElements = [];

        const esmOutput = outputRoot.directory('module');
        const esmBundler = new ScriptBundler();
        this.listenBundler(esmBundler);
        await esmBundler.setup({
            code,
            root,
            input: scriptInput,
            output: esmOutput,
            format: 'esm',
            targets: 'esmodules',
            bundle: true,
            production: this.options.get('production'),
            map: this.options.get('map'),
            polyfill: this.options.get('polyfill'),
            lint: this.options.get('lint'),
            jsx: this.options.get('jsx'),
        });

        await esmBundler.build();
        const moduleScript = document.createElement('script');
        if (!supportModules) {
            moduleScript.textContent = `import('${this.base.replace(/^\/*$/, '')}/${outputRoot.relative(esmOutput.file(scriptInput.name))}');window.__esm__ = true;`;
        } else {
            moduleScript.src = outputRoot.relative(esmOutput.file(scriptInput.name));
        }
        moduleScript.setAttribute('type', 'module');
        this.addResources(...esmBundler.files);
        this.scriptsBundlers.push(esmBundler);
        moduleElements.push(moduleScript);

        if (!supportModules) {
            const umdOutput = outputRoot.directory('nomodule');
            const systemUrl = join(__dirname, 'libs', 'system.js');
            const systemOutput = umdOutput.file('system.js');
            systemOutput.write(readFileSync(systemUrl, 'utf8'));
            const systemScript = document.system = document.createElement('script');
            systemScript.src = outputRoot.relative(systemOutput);
            systemScript.setAttribute('type', 'text/javascript');
            systemScript.setAttribute('nomodule', '');
            document.head.appendChild(systemScript);

            const systemBundler = new ScriptBundler();
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
                jsx: this.options.get('jsx'),
                lint: false,
            });
            await systemBundler.build();
            const nomoduleScript = document.createElement('script');
            nomoduleScript.textContent = `!window.__esm__ && System.import('${this.base.replace(/^\/*$/, '')}/${outputRoot.relative(umdOutput.file(scriptInput.name))}')`;
            nomoduleScript.setAttribute('type', 'text/javascript');
            nomoduleScript.setAttribute('nomodule', '');
            this.scriptsBundlers.push(systemBundler);
            moduleElements.push(nomoduleScript);
        }

        return moduleElements;
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
        const iconLink = document.querySelector('link[rel*="icon"]');
        if (!iconLink && !iconFile) {
            return;
        }

        const input = this.options.get('input');
        const output = this.options.get('output');

        const iconSource = iconFile ? iconFile : input.parent.file(iconLink.href.replace('file:///', ''));
        const iconsOutput = output.parent.file(input.parent.relative(iconSource)).parent;
        this.addResources(iconSource.path);

        [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"]')]
            .forEach((link) => link.parentNode.removeChild(link));

        const bundler = new IconBundler();
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
        const generated = await bundler.build();
        this.addResources(...bundler.files);
        definitions.forEach((definition) => {
            const icon = generated.find(({ name }) => name === definition.name);
            if (!icon) {
                return;
            }
            const href = this.options.get('output').parent.relative(icon.file);
            if (icon.name.startsWith('favicon')) {
                const link = document.createElement('link');
                link.setAttribute('rel', 'icon');
                link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                link.setAttribute('href', `${this.base.replace(/^\/*$/, '')}/${href}`);
                document.head.appendChild(link);

                if (icon.size === 196) {
                    const link = document.createElement('link');
                    link.setAttribute('rel', 'shortcut icon');
                    link.setAttribute('href', `${this.base.replace(/^\/*$/, '')}/${href}`);
                    document.head.appendChild(link);
                }
            } else if (icon.name.startsWith('apple-touch')) {
                const link = document.createElement('link');
                link.setAttribute('rel', 'apple-touch-icon');
                link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                link.setAttribute('href', `${this.base.replace(/^\/*$/, '')}/${href}`);
                document.head.appendChild(link);
            } else if (icon.name.startsWith('apple-launch')) {
                const link = document.createElement('link');
                link.setAttribute('rel', 'apple-touch-startup-image');
                link.setAttribute('media', definition.query);
                link.setAttribute('href', `${this.base.replace(/^\/*$/, '')}/${href}`);
                document.head.appendChild(link);
            }
        });
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
        let manifestInput = manifestFile ? manifestFile : input.parent.file(manifestLink.href.replace('file:///', ''));
        let manifestOutput = manifestFile;
        if (!manifestOutput) {
            if (manifestLink) {
                manifestOutput = output.parent.file(manifestLink.href.replace('file:///', ''));
            } else {
                manifestOutput = output.parent.file('manifest.webmanifest');
            }
        }
        let iconSource = iconFile ? iconFile : (iconElement && input.parent.file(iconElement.href.replace('file:///', '')));
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
            this.base = manifest.scope;
        } else if (document.querySelector('base')) {
            this.base = document.querySelector('base').getAttribute('href');
        } else {
            this.base = '';
        }
        if (manifest.theme_color) {
            if (!document.querySelector('meta[name="theme-color"]')) {
                let metaElement = document.createElement('meta');
                document.head.appendChild(metaElement);
                metaElement.setAttribute('name', 'theme-color');
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
            manifestLink.setAttribute('href', `${this.base.replace(/^\/*$/, '')}/${input.parent.relative(manifestOutput)}`);
        }
        return bundler;
    }

    /**
     * @inheritdoc
     */
    async write() {
        let output = this.options.get('output');

        this.emit(HTMLBundler.WRITE_START);

        let bundlers = this.bundlers;
        for (let i = 0; i < bundlers.length; i++) {
            await bundlers[i].write();
        }

        let outHtml = beautify(this.result.code, {
            indent_size: 4,
            indent_char: ' ',
            preserve_newlines: false,
        });
        output.write(`<!DOCTYPE html>\n${outHtml}`);
        this.emit(HTMLBundler.WRITE_PROGRESS, output);

        this.emit(HTMLBundler.WRITE_END);

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
