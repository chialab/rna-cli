const { readFileSync } = require('fs');
const { extname } = require('path');
const { JSDOM } = require('jsdom');
const resolve = require('resolve');
const { html: beautify } = require('js-beautify');
const { isJSFile, isStyleFile, File, Directory, Project } = require('../File');
const Bundler = require('./Bundler');
const Targets = require('../Targets');
const CopyBundler = require('./CopyBundler');
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
                gutter: 30,
                type: 'icon',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
            {
                name: 'apple-touch-icon-ipad.png',
                size: 167,
                gutter: 30,
                type: 'icon',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
            {
                name: 'apple-launch-iphonex.png',
                width: 1125,
                height: 2436,
                query: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
                type: 'splash',
            },
            {
                name: 'apple-launch-iphone8.png',
                width: 750,
                height: 1334,
                query: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-iphone8-plus.png',
                width: 1242,
                height: 2208,
                query: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
                type: 'splash',
            },
            {
                name: 'apple-launch-iphone5.png',
                width: 640,
                height: 1136,
                query: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-ipadair.png',
                width: 1536,
                height: 2048,
                query: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-ipadpro10.png',
                width: 1668,
                height: 2224,
                query: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)',
                type: 'splash',
            },
            {
                name: 'apple-launch-ipadpro12.png',
                width: 2048,
                height: 2732,
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
            options.root = new Directory(root);
        } else if (!root) {
            options.root = await Project.getProject(input);
        }

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(invalidate) {
        await super.build(invalidate);

        let { input, root, fragment } = this.options;
        if (await input.isNew()) {
            throw new Error(`missing "input" file ${root.relative(input)} for ${this.name}`);
        }

        this.emit(HTMLBundler.BUNDLE_START_EVENT, input);

        try {
            let icons = this.options.icons || this.constructor.ICONS;

            await this.addResources(input.path);

            let document;
            let invalidating = !this.result || invalidate.find((file) => file.path === input.path);
            if (invalidating) {
                this.emit(HTMLBundler.BUILD_START_EVENT, input, null);

                let html = await input.read();
                document = new JSDOM(html, {
                    url: 'file:///index.html',
                    referrer: 'file:///index.html',
                }).window.document;

                if (this.options.base) {
                    this.base = this.options.base;
                } else if (document.querySelector('base')) {
                    this.base = document.querySelector('base').getAttribute('href');
                } else {
                    this.base = '';
                }

                if (this.options.webmanifest !== false && !fragment) {
                    let bundler = await this.handleWebManifest(document, this.options.webmanifest, this.options.icon);
                    if (bundler) {
                        this.webmanifestBundler = bundler;
                    }
                }
                if (this.options.links !== false) {
                    this.linksBundlers = [];
                    await this.handleLinks(document);
                }
                if (this.options.styles !== false) {
                    this.stylesBundlers = [];
                    await this.handleStyles(document);
                }
                if (this.options.scripts !== false) {
                    this.scriptsBundlers = [];
                    await this.handleScripts(document);
                }
                if (this.options.sources !== false) {
                    this.sourcesBundlers = [];
                    await this.handleSources(document);
                }
                if (this.options.icon !== false && !fragment) {
                    let bundler = await this.handleIcon(document, icons, this.options.icon);
                    if (bundler) {
                        this.iconBundler = bundler;
                    }
                }

                this.emit(HTMLBundler.BUILD_END_EVENT, input, null);
            } else {
                document = this.result.document;
                // check resource bundles invalidation.
                await Promise.all(
                    this.bundlers
                        .map(async (bundle) => {
                            if (invalidate.some((file) => bundle.files.includes(file.path))) {
                                await bundle.build(invalidate);
                            }
                            await this.addResources(...bundle.files);
                        })
                );
            }

            let description = this.options.description;
            if (description && !document.querySelector('meta[name="description"]')) {
                let metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                metaDesc.setAttribute('content', description);
                document.head.prepend(metaDesc);
            }

            let title = this.options.title;
            if (title && !document.querySelector('title')) {
                let titleElem = document.createElement('title');
                titleElem.textContent = title;
                document.head.prepend(titleElem);
            }

            this.result = {
                document,
                fragment: fragment ? JSDOM.fragment(document.head.innerHTML + document.body.innerHTML) : document.documentElement,
                code: fragment ? document.head.innerHTML + document.body.innerHTML  : document.documentElement.outerHTML,
            };

            this.emit(HTMLBundler.BUNDLE_END_EVENT, this.result);

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
        let input = this.options.input;
        let root = input.parent;
        let elements = (await Promise.all(
            [...document.querySelectorAll('link[href], a[download][href], iframe[href]')]
                .filter((element) => !element.getAttribute('rel').match(/\b(manifest|icon)\b/i))
                .filter((element) => !!element.href)
                .filter((element) => element.href.startsWith('file://'))
                .map(async (element) => {
                    let file = root.file(element.href.replace(`file://${this.base || '/'}`, ''));
                    if (await file.isNew()) {
                        this.emit(HTMLBundler.WARN_EVENT, `referenced file '${file.path}' does not exists`);
                        return null;
                    }

                    return element;
                })
        )).filter(Boolean);

        return await Promise.all(
            elements.map(async (element) => {
                let type = element.getAttribute('type');
                let rel = element.getAttribute('rel');
                let href = element.href.replace(`file://${this.base || '/'}`, '');
                let inputFile = input.parent.file(href);
                if (
                    type === 'text/css' ||
                    rel === 'stylesheet' ||
                    element.getAttribute('as') === 'style' ||
                    isStyleFile(inputFile.path)
                ) {
                    // css file
                    let callback = this.options.handleStyleLink;
                    element.setAttribute('type', 'text/css');
                    element.setAttribute('href', await ((callback && callback(inputFile, root, element, document, 'style')) || this.handleStyleLink(inputFile, root, element, document)));
                } else if (
                    type === 'text/javascript' ||
                    type === 'application/javascript' ||
                    element.getAttribute('as') === 'script' ||
                    isJSFile(inputFile.path)
                ) {
                    // javascript file
                    let callback = this.options.handleScriptLink;
                    element.setAttribute('type', 'text/javascript');
                    element.setAttribute('href', await ((callback && callback(inputFile, root, element, document, 'script')) || this.handleScriptLink(inputFile, root, element, document)));
                } else {
                    let callback = this.options.handleAssetLink;
                    element.setAttribute('href', await ((callback && callback(inputFile, root, element, document, 'asset')) || this.handleAssetLink(inputFile, root, element, document)));
                }
            })
        );
    }

    async handleStyleLink(input, root, element) {
        let output = this.options.output;
        if (!output) {
            throw new Error('missing output option for link');
        }
        let href = element.href.replace(`file://${this.base || '/'}`, '');
        let outputFile = output.parent.file(href).ext('.css');
        let bundler = new StyleBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
            root: this.options.root,
            targets: this.options.targets,
            production: this.options.production,
            map: this.options.map,
            lint: this.options.lint,
            handleAssets: this.options.handleCSSAssets,
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        await this.addResources(...bundler.files);
        return `${this.base || ''}${output.parent.relative(outputFile)}`;
    }

    async handleScriptLink(input, root, element) {
        let output = this.options.output;
        if (!output) {
            throw new Error('missing output option for link');
        }
        let href = element.href.replace(`file://${this.base || '/'}`, '');
        let outputFile = output.file(href).ext('.js');
        let bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
            bundle: true,
            format: 'umd',
            targets: this.options.targets,
            production: this.options.production,
            map: this.options.map,
            jsx: this.options.jsx,
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        await this.addResources(...bundler.files);
        return `${this.base || ''}${output.relative(outputFile)}`;
    }

    async handleAssetLink(input, root, element) {
        let output = this.options.output;
        if (!output) {
            throw new Error('missing output option for link');
        }
        let outputRoot = output.parent;
        let href = element.href.replace(`file://${this.base || '/'}`, '');
        let outputFile = outputRoot.file(href);
        let bundler = new CopyBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
        });
        await bundler.build();
        this.linksBundlers.push(bundler);
        await this.addResources(...bundler.files);
        return `${this.base || ''}${outputRoot.relative(outputFile)}`;
    }

    /**
     * Handle elements with a source. Exec bundle on javascript files.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of bundlers.
     */
    async handleSources(document) {
        let { input, output } = this.options;
        let root = input.parent;
        let outputRoot = output.parent;
        let elements = (await Promise.all(
            [...document.querySelectorAll('[src]:not(script)')]
                .filter((element) => !!element.src)
                .filter((element) => element.src.startsWith('file://'))
                .map(async (element) => {
                    let file = root.file(element.src.replace(`file://${this.base || '/'}`, ''));
                    if (await file.isNew()) {
                        this.emit(HTMLBundler.WARN_EVENT, `referenced file '${file.path}' does not exists`);
                        return false;
                    }

                    return element;
                })
        )).filter(Boolean);

        await Promise.all(
            elements.map(async (element) => {
                let href = element.src.replace(`file://${this.base || '/'}`, '');
                let inputFile = root.file(href);
                let outputFile = outputRoot.file(href);
                let bundler = new CopyBundler();
                this.listenBundler(bundler);
                await bundler.setup({
                    input: inputFile,
                    output: outputFile,
                });
                await bundler.build();
                element.setAttribute('src', `${this.base || ''}${outputRoot.relative(outputFile)}`);
                await this.addResources(...bundler.files);
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
        let callback = this.options.handleStyleCode;
        let input = this.options.input;
        let root = input.parent;
        let styleElements = [...document.querySelectorAll('style')];
        await Promise.all(
            styleElements.map(async (element) => {
                element.textContent = await ((callback && callback(element.textContent, root, element, document)) || this.handleStyleCode(element.textContent, root, element, document));
            })
        );

        let nodeElements = [...document.querySelectorAll('[style]')];
        await Promise.all(
            nodeElements.map(async (element) => {
                element.setAttribute('style', await ((callback && callback(element.getAttribute('style'), root, element, document)) || this.handleStyleCode(element.getAttribute('style'), root, element, document)));
            })
        );
    }

    async handleStyleCode(code) {
        let bundler = new StyleBundler();
        let output = this.options.output;
        let outputRoot = output && output.parent;
        this.listenBundler(bundler);
        await bundler.setup({
            code,
            root: this.options.root,
            output: outputRoot,
            targets: this.options.targets,
            production: this.options.production,
            map: this.options.map,
            handleAssets: this.options.handleCSSAssets,
        });
        this.stylesBundlers.push(bundler);
        await this.addResources(...bundler.files);
        let { css } = await bundler.build();
        return css.toString();
    }

    /**
     * Handle <script> inline elements.
     * @private
     * @param {Document} document The main document instance.
     * @return {Promise} A list of style bundlers.
     */
    async handleScripts(document) {
        let input = this.options.input;
        let root = input.parent;
        let elements = [...document.querySelectorAll('script')];
        let scriptModules = elements.filter((element) => element.getAttribute('type') === 'module');
        let scripts = elements.filter((element) => element.getAttribute('type') !== 'module');
        if (scripts.length) {
            await Promise.all(
                scripts
                    .filter((element) => !element.src || element.src.startsWith('file://'))
                    .map(async (element) => {
                        element.setAttribute('type', 'text/javascript');
                        if (element.src) {
                            let callback = this.options.handleScriptFile;
                            let href = element.src.replace(`file://${this.base || '/'}`, '');
                            let inputFile = root.file(href);
                            element.setAttribute('src', await ((callback && callback(inputFile, root, element, document)) || this.handleScriptFile(inputFile, root, element, document)));
                            return;
                        }
                        let callback = this.options.handleScriptCode;
                        element.textContent = await ((callback && callback(element.textContent, root, element, document)) || this.handleScriptCode(element.textContent, root, element, document));
                    })
            );
        }

        if (scriptModules.length) {
            let callback = this.options.handleScriptModules;
            let withSrc = scriptModules.filter((script) => script.hasAttribute('src'));
            let withoutSrc = scriptModules.filter((script) => !script.hasAttribute('src'));
            let code = withSrc.map((script) => `export * from './${root.relative(root.file(script.src.replace(`file://${this.base || '/'}`, '')))}'`).join('\n');
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
        if (!this.options.output) {
            throw new Error('missing output option for script');
        }
        let href = element.src.replace(`file://${this.base || '/'}`, '');
        let outputRoot = this.options.output.parent;
        let outputFile = outputRoot.file(href).ext('.js');
        let bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input,
            output: outputFile,
            format: 'umd',
            targets: this.options.targets,
            bundle: true,
            production: this.options.production,
            map: this.options.map,
            lint: this.options.lint,
            jsx: this.options.jsx,
        });
        await bundler.build();
        this.scriptsBundlers.push(bundler);
        await this.addResources(...bundler.files);
        return `${this.base || ''}${outputRoot.relative(outputFile)}`;
    }

    async handleScriptCode(code, root) {
        let bundler = new ScriptBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            code,
            root,
            format: 'esm',
            targets: this.options.targets,
            bundle: true,
            vendors: true,
            production: this.options.production,
            map: this.options.map,
            lint: this.options.lint,
            jsx: this.options.jsx,
        });
        let result = await bundler.build();
        this.scriptsBundlers.push(bundler);
        await this.addResources(...bundler.files);
        return result.code;
    }

    async handleScriptModules(code, root, elements, document) {
        let { input, output, format } = this.options;
        if (!output) {
            throw new Error('missing output option for script');
        }
        let targets = Targets.parse(this.options.targets);
        let supportTargets = Targets.fromFeatures('module', 'async');
        let supportModules = targets.check(supportTargets);

        let scriptInput = input.parent.file(`${input.basename}.m.js`);
        let outputRoot = output.parent;

        if (!format || ['es', 'esm'].includes(format)) {
            let moduleElements = [];
            let esmOutput = outputRoot.directory('module');
            let esmBundler = new ScriptBundler();
            this.listenBundler(esmBundler);
            await esmBundler.setup({
                code,
                root,
                input: scriptInput,
                output: esmOutput,
                format: 'esm',
                targets: supportTargets.toQuery(),
                bundle: true,
                vendors: true,
                production: this.options.production,
                map: this.options.map,
                lint: this.options.lint,
                jsx: this.options.jsx,
            });

            await esmBundler.build();
            let moduleScript = document.createElement('script');
            if (!supportModules) {
                moduleScript.textContent = `(async () => await import('${this.base || './'}${outputRoot.relative(esmOutput.file(scriptInput.name))}'))();window.__esm__ = true;`;
            } else {
                moduleScript.setAttribute('type', 'module');
                moduleScript.setAttribute('src', `${this.base || './'}${outputRoot.relative(esmOutput.file(scriptInput.name))}`);
            }
            await this.addResources(...esmBundler.files);
            this.scriptsBundlers.push(esmBundler);
            moduleElements.push(moduleScript);

            if (!supportModules) {
                let systemOutput = outputRoot.directory('nomodule');
                let systemUrl = resolve.sync('systemjs/dist/s.min', {
                    basedir: __dirname,
                });
                let systemCode = readFileSync(systemUrl, 'utf8').replace(/\b(let|let)\b/g, 'var');
                let promisePolyfillUrl = resolve.sync('promise-polyfill/dist/polyfill.min', {
                    basedir: __dirname,
                });
                let promisePolyfillCode = readFileSync(promisePolyfillUrl, 'utf8');
                let fallbackBundler = new ScriptBundler();
                this.listenBundler(fallbackBundler);
                await fallbackBundler.setup({
                    code,
                    root,
                    input: scriptInput,
                    output: systemOutput,
                    format: 'system',
                    targets: this.options.targets,
                    bundle: true,
                    vendors: true,
                    production: this.options.production,
                    map: this.options.map,
                    jsx: this.options.jsx,
                    lint: false,
                });
                await fallbackBundler.build();
                let nomoduleScript = document.createElement('script');
                nomoduleScript.textContent = `!window.__esm__ && (function(){${promisePolyfillCode}${systemCode}System.import('${this.base || ''}${outputRoot.relative(systemOutput.file(scriptInput.name))}');})();`;
                nomoduleScript.setAttribute('type', 'text/javascript');
                this.scriptsBundlers.push(fallbackBundler);
                moduleElements.push(nomoduleScript);
            }
            return moduleElements;
        }

        let umdBundler = new ScriptBundler();
        this.listenBundler(umdBundler);
        await umdBundler.setup({
            code,
            root,
            input: scriptInput,
            output: outputRoot,
            format,
            targets: this.options.targets,
            bundle: true,
            production: this.options.production,
            map: this.options.map,
            lint: this.options.lint,
            jsx: this.options.jsx,
        });

        await umdBundler.build();
        let umdScript = document.createElement('script');
        umdScript.setAttribute('src', `${this.base || ''}${scriptInput.name}`);
        await this.addResources(...umdBundler.files);
        this.scriptsBundlers.push(umdBundler);
        return [umdScript];
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

        let { input, output } = this.options;

        let iconSource = iconFile ? iconFile : input.parent.file(iconLink.href.replace(`file://${this.base || '/'}`, ''));
        let iconsOutput = output.parent.file(input.parent.relative(iconSource)).parent;
        await this.addResources(iconSource.path);

        [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"]')]
            .forEach((link) => link.parentNode.removeChild(link));

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
        await this.addResources(...bundler.files);
        definitions.forEach((definition) => {
            let icon = generated.find(({ name }) => name === definition.name);
            if (!icon) {
                return;
            }
            let href = output.parent.relative(icon.file);
            if (icon.name.startsWith('favicon')) {
                let link = document.createElement('link');
                link.setAttribute('rel', 'icon');
                link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                link.setAttribute('href', `${this.base || ''}${href}`);
                document.head.appendChild(link);

                if (icon.size === 196) {
                    let link = document.createElement('link');
                    link.setAttribute('rel', 'shortcut icon');
                    link.setAttribute('href', `${this.base || ''}${href}`);
                    document.head.appendChild(link);
                }
            } else if (icon.name.startsWith('apple-touch')) {
                let link = document.createElement('link');
                link.setAttribute('rel', 'apple-touch-icon');
                link.setAttribute('sizes', `${icon.size}x${icon.size}`);
                link.setAttribute('href', `${this.base || ''}${href}`);
                document.head.appendChild(link);
            } else if (icon.name.startsWith('apple-launch')) {
                let link = document.createElement('link');
                link.setAttribute('rel', 'apple-touch-startup-image');
                link.setAttribute('media', definition.query);
                link.setAttribute('href', `${this.base || ''}${href}`);
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
        let baseElement = document.querySelector('base');
        if (!manifestLink && !manifestFile) {
            return;
        }
        let descriptionElement = document.querySelector('meta[name="description"]');
        let themeElement = document.querySelector('meta[name="theme"]');
        let iconElement = document.querySelector('link[rel*="icon"]');
        let { input, output } = this.options;
        let manifestInput = manifestFile ? manifestFile : input.parent.file(manifestLink.href.replace(`file://${this.base || '/'}`, ''));
        let manifestOutput = manifestFile;
        if (!manifestOutput) {
            if (manifestLink) {
                manifestOutput = output.parent.file(manifestLink.href.replace(`file://${this.base || '/'}`, ''));
            } else {
                manifestOutput = output.parent.file('manifest.webmanifest');
            }
        }
        let iconSource = iconFile ? iconFile : (iconElement && input.parent.file(iconElement.href.replace(`file://${this.base || '/'}`, '')));
        let bundler = new WebManifestBundler();
        this.listenBundler(bundler);
        await bundler.setup({
            input: manifestInput,
            output: manifestOutput,
            name: this.options.title || document.title,
            description: this.options.description || (descriptionElement && descriptionElement.content) || '',
            theme: themeElement ? themeElement.content : '',
            icon: iconSource,
            lang: document.documentElement.lang,
            overrides: {
                scope: this.options.base,
            },
        });
        await bundler.build();
        await this.addResources(...bundler.files);
        let manifest = bundler.result;
        if (manifest.name) {
            if (!document.querySelector('title')) {
                let titleElement = document.createElement('title');
                document.head.appendChild(titleElement);
                titleElement.textContent = manifest.name;
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
            manifestLink.setAttribute('href', `${this.base || ''}${input.parent.relative(manifestOutput)}`);
        }
        return bundler;
    }

    /**
     * @inheritdoc
     */
    async write() {
        let { input, output } = this.options;

        this.emit(HTMLBundler.WRITE_START_EVENT);

        let bundlers = this.bundlers;
        for (let i = 0; i < bundlers.length; i++) {
            if (!bundlers[i].written) {
                await bundlers[i].write();
            }
        }

        let outHtml = beautify(this.result.code, {
            indent_size: 4,
            indent_char: ' ',
            preserve_newlines: false,
            content_unformatted: ['script', 'style'],
        });
        await output.write(`<!DOCTYPE html>\n${outHtml}`);
        this.emit(HTMLBundler.WRITE_PROGRESS_EVENT, output);

        if (this.options.serviceWorker !== false && this.webmanifestBundler) {
            let manifest = this.webmanifestBundler.result;
            if (this.bundlerSW) {
                await this.bundlerSW.build();
                await this.bundlerSW.write();
                await this.addResources(...this.bundlerSW.files);
            } else if (manifest.serviceworker && manifest.serviceworker.src) {
                let inputSW = input.parent.file(manifest.serviceworker.src);
                let outputSW = output.parent.file(manifest.serviceworker.src);
                let bundler = this.bundlerSW = new ScriptBundler();
                await bundler.setup({
                    input: inputSW,
                    output: outputSW,
                    root: input.parent,
                    production: this.options.production,
                    format: 'umd',
                    targets: 'esmodules',
                    bundle: true,
                    sw: {
                        root: output.parent.path,
                        exclude: [
                            '**/nomodule/**/*',
                            outputSW.name,
                        ],
                    },
                    map: this.options.map,
                });
                await bundler.build();
                await bundler.write();
                await this.addResources(...bundler.files);
                this.listenBundler(bundler);
                this.bundlers.push(bundler);
            }
        }

        this.emit(HTMLBundler.WRITE_END_EVENT);
        await super.write();
        return output;
    }
}

module.exports = HTMLBundler;
