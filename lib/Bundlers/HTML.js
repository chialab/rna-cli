const { existsSync, readFile, ensureFile, writeFile } = require('fs-extra');
const { join, dirname, relative, resolve, basename, extname } = require('path');
const { EventEmitter } = require('events');
const { JSDOM } = require('jsdom');
const { html: beautify } = require('js-beautify');
const PostCSS = require('./PostCSS');
const Rollup = require('./Rollup');
const WebManifest = require('./WebManifest');
const IconGenerator = require('./IconGenerator');

/**
 * Handle <link rel="stylesheets"> elements when bundling html files.
 * @param {Document} document The main document instance.
 * @param {Object} options The HTML bundler configuration.
 * @return {Array<PostCSS>} A list of css bundlers.
 */
async function handleStyles(document, options) {
    let links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    return links.map((link) => {
        let href = link.href.replace(/^file:\/\//, '');
        let relativeOutput = relative(dirname(options.input), href);
        let outputName = `${basename(relativeOutput, extname(relativeOutput))}.css`;
        let outputUrl = join(dirname(relativeOutput), outputName);
        let output = resolve(dirname(options.output), outputUrl);
        link.href = outputUrl;
        link.setAttribute('type', 'text/css');
        return new PostCSS(Object.assign(options.css || {}, {
            input: href,
            output,
        }));
    });
}

/**
 * Convert a file path to CamelCase.
 *
 * @param {string} file The file path.
 * @returns {string}
 */
function camelize(file) {
    let filename = basename(file, extname(file));
    return filename.replace(/(^[a-z0-9]|[-_]([a-z0-9]))/g, (g) => (g[1] || g[0]).toUpperCase());
}

/**
 * Handle <script src="..."> elements when bundling html files.
 * @param {Document} document The main document instance.
 * @param {Object} options The HTML bundler configuration.
 * @return {Array<Rollup>} A list of Rollup bundlers.
 */
async function handleScripts(document, options) {
    let scripts = [...document.querySelectorAll('script[src]:not([type="module"])')];
    return scripts.map((script) => {
        let href = script.src.replace(/^file:\/\//, '');
        let relativeOutput = relative(dirname(options.input), href);
        let outputName = `${basename(relativeOutput, extname(relativeOutput))}.js`;
        let outputUrl = join(dirname(relativeOutput), outputName);
        let output = resolve(dirname(options.output), outputUrl);
        script.src = outputUrl;
        script.setAttribute('type', 'text/javascript');
        let config = Object.assign(options.javascript || {}, {
            input: href,
        });
        config.output = Object.assign(config.output || {}, {
            file: output,
            name: camelize(outputName),
        });
        return new Rollup(config);
    });
}

const FAVICONS = {
    FAVICON_16x16: {
        name: 'favicon-16x16.png',
        size: 16,
        type: 'icon',
    },
    FAVICON_32x32: {
        name: 'favicon-32x32.png',
        size: 32,
        type: 'icon',
    },
    FAVICON_192x192: {
        name: 'favicon-192x192.png',
        size: 192,
        type: 'icon',
    },
    FAVICON_48x48: {
        name: 'favicon-48x48.png',
        size: 48,
        type: 'icon',
    },
    APPLE_TOUCH_ICON: {
        name: 'apple-touch-icon.png',
        size: 180,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        gutter: 30,
        type: 'icon',
    },
    APPLE_TOUCH_ICON_IPAD: {
        name: 'apple-touch-icon-ipad.png',
        size: 167,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        gutter: 30,
        type: 'icon',
    },
    IPHONE_X: {
        name: 'apple-launch-iphonex.png',
        width: 1125,
        height: 2436,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
        type: 'splash',
    },
    IPHONE_8: {
        name: 'apple-launch-iphone8.png',
        width: 750,
        height: 1334,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
        type: 'splash',
    },
    IPHONE_8_PLUS: {
        name: 'apple-launch-iphone8-plus.png',
        width: 1242,
        height: 2208,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
        type: 'splash',
    },
    IPHONE_5: {
        name: 'apple-launch-iphone5.png',
        width: 640,
        height: 1136,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
        type: 'splash',
    },
    IPAD_AIR: {
        name: 'apple-launch-ipadair.png',
        width: 1536,
        height: 2048,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
        type: 'splash',
    },
    IPAD_PRO_10: {
        name: 'apple-launch-ipadpro10.png',
        width: 1668,
        height: 2224,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)',
        type: 'splash',
    },
    IPAD_PRO_12: {
        name: 'apple-launch-ipadpro12.png',
        width: 2048,
        height: 2732,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        query: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
        type: 'splash',
    },
};

/**
 * Handle <link rel="icon"> element when bundling html files.
 * @param {Document} document The main document instance.
 * @param {Object} options The HTML bundler configuration.
 * @return {IconGenerator} An icon generator.
 */
async function handleIcon(document, options) {
    let iconLink = document.querySelector('link[rel="icon"]');
    if (!iconLink) {
        return;
    }

    let iconSource = iconLink.href.replace(/^file:\/\//, '');
    return new IconGenerator({
        input: iconSource,
        output: Object.values(FAVICONS).map(({ name, size, width, height, gutter, background, type }) => {
            let iconRelative = relative(dirname(options.input), iconSource);
            let iconOutput = join(resolve(dirname(options.output), dirname(iconRelative)), name);
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
}

/**
 * Handle <link rel="manifest"> element when bundling html files.
 * @param {Document} document The main document instance.
 * @param {Object} options The HTML bundler configuration.
 * @return {WebManifest} A manifest bundler.
 */
async function handleWebManifest(document, options) {
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
        return;
    }
    let descriptionElement = document.querySelector('meta[name="description"]');
    let baseElement = document.querySelector('base');
    let themeElement = document.querySelector('meta[name="theme"]');
    let iconElement = document.querySelector('link[rel="icon"]');
    let href = manifestLink.href.replace(/^file:\/\//, '');
    let relativeOutput = relative(dirname(options.input), href);
    let outputName = `${basename(relativeOutput, extname(relativeOutput))}.webmanifest`;
    let outputUrl = join(dirname(relativeOutput), outputName);
    let output = resolve(dirname(options.output), outputUrl);
    manifestLink.href = outputUrl;
    return new WebManifest({
        input: href,
        output,
        name: document.title,
        description: descriptionElement ? descriptionElement.content : '',
        scope: baseElement ? baseElement.getAttribute('href') : '',
        theme: themeElement ? themeElement.content : '',
        icon: iconElement ? iconElement.href.replace(/^file:\/\//, '') : '',
        lang: document.documentElement.lang,
    });
}

function setTitle(document, options, title) {
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

function setDescription(document, options, description) {
    if (!document.querySelector('meta[name="description"]')) {
        let metaElement = document.createElement('meta');
        document.head.appendChild(metaElement);
        metaElement.setAttribute('name', 'description');
        metaElement.setAttribute('content', description);
    }
}

function setBase(document, options, baseHref) {
    if (!document.querySelector('base')) {
        let baseElement = document.createElement('base');
        document.head.appendChild(baseElement);
        baseElement.setAttribute('href', baseHref);
    }
}

function setTheme(document, options, theme) {
    if (!document.querySelector('meta[name="theme"]')) {
        let metaElement = document.createElement('meta');
        document.head.appendChild(metaElement);
        metaElement.setAttribute('name', 'theme');
        metaElement.setAttribute('content', theme);
    }
}

function setLang(document, options, lang) {
    if (!document.documentElement.hasAttribute('lang')) {
        document.documentElement.setAttribute('lang', lang);
    }
}

function setIcons(document, options, icons) {
    for (let key in FAVICONS) {
        let iconDefinition = FAVICONS[key];
        let icon = icons.find(({ name }) => name === iconDefinition.name);
        if (!icon) {
            continue;
        }
        let href = relative(dirname(options.output), icon.file);
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
            // <link rel="apple-touch-startup-image" media="${rule.query}" href="${root.relative(image.src)}">
            if (!document.querySelector(`link[rel="apple-touch-startup-image"][media="${iconDefinition.query}"]`)) {
                let link = document.createElement('link');
                link.setAttribute('rel', 'apple-touch-startup-image');
                link.setAttribute('media', iconDefinition.query);
                link.setAttribute('href', href);
                document.head.appendChild(link);
            }
        }
    }
}

/**
 * Bundle a HTML file and all its resources.
 */
class HTML extends EventEmitter {
    static detectConfig(app, project, options = {}) {
        return {
            input: options.input.path,
            output: options.output.path,
            css: PostCSS.detectConfig(app, project, {
                production: options.production,
                map: options.map,
                lint: options.lint,
                targets: options.targets,
            }),
            javascript: Rollup.detectConfig(app, project, {
                production: options.production,
                map: options.map,
                lint: options.lint,
                targets: options.targets,
                format: 'umd',
            }),
        };
    }

    /**
     * Create a HTML bundler instance.
     * @param {HTMLOptions} options A set of options for the HTML bundler.
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
     * Build the HTML file and all its resources.
     * @return {Promise<void>}
     */
    async build() {
        let { input } = this.options;
        if (!input) {
            throw 'missing "input" option';
        }
        if (!existsSync(input)) {
            throw 'missing "input" file';
        }
        this.resources.push(input);
        let html = await readFile(input);
        let document = new JSDOM(html, {
            url: `file:///${input}`,
            referrer: `file:///${input}`,
        }).window.document;

        let bundles = this.bundlers = [
            ...(await handleStyles(document, this.options)),
            ...(await handleScripts(document, this.options)),
        ];

        let manifestBundle = await handleWebManifest(document, this.options);
        if (manifestBundle) {
            bundles.push(manifestBundle);
        }

        let iconBundle = await handleIcon(document, this.options);
        if (iconBundle) {
            bundles.push(iconBundle);
        }

        await Promise.all(
            bundles.map(async (bundler) => {
                await bundler.build();
                bundler.files.forEach((file) => {
                    if (!this.resources.includes(file)) {
                        this.resources.push(file);
                    }
                });
            })
        );

        if (manifestBundle) {
            let manifest = manifestBundle.result;
            if (manifest.name) {
                setTitle(document, this.options, manifest.name);
            }
            if (manifest.description) {
                setDescription(document, this.options, manifest.description);
            }
            if (manifest.scope) {
                setBase(document, this.options, manifest.scope);
            }
            if (manifest.theme_color) {
                setTheme(document, this.options, manifest.theme_color);
            }
            if (manifest.lang) {
                setLang(document, this.options, manifest.lang);
            }
        }

        if (iconBundle) {
            setIcons(document, this.options, iconBundle.result);
        }

        return this.result = document;
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

        await Promise.all(
            this.bundlers.map((bundler) => bundler.write())
        );

        let outHtml = beautify(this.result.documentElement.outerHTML, {
            indent_size: 4,
            indent_char: ' ',
            preserve_newlines: false,
        });

        await ensureFile(output);
        await writeFile(output, `<!DOCTYPE html>\n${outHtml}`);
    }
}

module.exports = HTML;
