/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('manifest')
        .description('Generate webapp Manifest.')
        .readme(`${__dirname}/README.md`)
        .option('<path>', 'The webapp path.')
        .option('--output', 'Where to save the generated manifest.')
        .option('[--manifest]', 'An input manifest file.')
        .option('[--icon]', 'The path of the main icon to generate.')
        .option('[--index]', 'Path to the index.html to update.')
        .option('[--scope]', 'Force manifest scope.')
        .action(async (app, options = {}) => {
            const path = require('path');
            const Project = require('../../lib/Project');
            const JSDOM = require('jsdom').JSDOM;

            const cwd = process.cwd();
            const project = new Project(cwd);

            let root;
            if (options.arguments.length) {
                root = project.directory(options.arguments[0]);
            } else {
                root = project;
            }

            let manifest = {};
            let index;
            let manifestPath;
            let indexPath;
            let inputManifest;
            let inputIndex;

            if (options.manifest) {
                inputManifest = project.file(options.manifest);
            }

            if (typeof options.index === 'string') {
                inputIndex = project.file(options.index);
            }

            if (options.output) {
                let outputDir = project.directory(options.output);
                // use output flag if defined.
                if (inputManifest) {
                    manifestPath = outputDir.file(inputManifest.basename);
                } else {
                    manifestPath = outputDir.file('manifest.json');
                }
                if (inputIndex) {
                    indexPath = outputDir.file(inputIndex.basename);
                } else {
                    indexPath = outputDir.file('index.html');
                }
            } else {
                // default manifest path.
                manifestPath = root.file('manifest.json');
                if (options.index) {
                    indexPath = root.file('index.html');
                }
            }

            if (inputManifest.exists()) {
                // if a manifest already exists, use it.
                manifest = inputManifest.readJson();
            }

            // create a fake DOM document for the index.html
            if (inputIndex.exists()) {
                index = new JSDOM(inputIndex.read(), {
                    url: 'https://example.org/',
                    referrer: 'https://example.com/',
                }).window.document;
            }

            // set manifest defaults
            manifest.name = manifest.name || project.get('name') || path.basename(cwd);
            manifest.short_name = manifest.short_name || manifest.name || project.get('name') || path.basename(cwd);
            manifest.description = manifest.description || project.get('description');
            manifest.start_url = manifest.start_url || '/';
            manifest.scope = manifest.scope || '/';
            manifest.display = manifest.display || 'standalone';
            manifest.orientation = manifest.orientation || 'any';
            manifest.theme_color = manifest.theme_color || '#000';
            manifest.background_color = manifest.background_color || '#fff';
            manifest.lang = manifest.lang || 'en-US';

            if (typeof options.icon === 'string') {
                // generate icons.
                const icon = project.file(options.icon);
                if (!icon.exists()) {
                    // provided icons does not exists.
                    throw `icon file not found. (${icon.localPath})`;
                }
                // exec the request.
                app.logger.play('generating icons...');
                try {
                    const iconsPath = await generateIcons(manifest, index, icon, root);
                    app.logger.stop();
                    app.logger.success('icons generated');
                    iconsPath.files().forEach((iconPath) => {
                        let { size, zipped } = iconPath.size;
                        app.logger.info(iconPath.localPath, `${size}, ${zipped} zipped`);
                    });
                } catch (err) {
                    app.logger.stop();
                    throw err;
                }
            }

            if (options.scope) {
                manifest.scope = options.scope;
            }

            if (index) {
                if (manifest.scope) {
                    // update index <base> using manifest.scope
                    let base = index.querySelector('base') || index.createElement('base');
                    base.setAttribute('href', manifest.scope);
                    if (!base.parentNode) {
                        index.head.appendChild(base);
                    }
                }
                // update index meta title
                let meta = index.querySelector('meta[name="apple-mobile-web-app-title"]') || index.createElement('meta');
                meta.setAttribute('name', 'apple-mobile-web-app-title');
                meta.setAttribute('content', manifest.name || manifest.short_name);
                if (!meta.parentNode) {
                    index.head.appendChild(meta);
                }
                // update index title
                let title = index.querySelector('title') || index.createElement('title');
                title.innerHTML = manifest.name || manifest.short_name;
                if (!title.parentNode) {
                    index.head.appendChild(title);
                }
                // update theme meta
                if (manifest.theme) {
                    let theme = index.querySelector('meta[name="theme-color"]') || index.createElement('meta');
                    theme.setAttribute('name', 'theme-color');
                    theme.setAttribute('content', manifest.theme);
                    if (!theme.parentNode) {
                        index.head.appendChild(theme);
                    }
                }
                // update manifest link
                let link = index.querySelector('link[rel="manifest"]') || index.createElement('link');
                link.setAttribute('rel', 'manifest');
                link.setAttribute('href', manifestPath.basename);
                if (!link.parentNode) {
                    index.head.appendChild(link);
                }

                // beautify html
                let html = require('js-beautify').html(
                    index.documentElement.outerHTML, {
                        indent_size: 4,
                        indent_char: ' ',
                        preserve_newlines: false,
                    }
                );
                indexPath.write(`<!DOCTYPE html>\n${html}`);
                let { size, zipped } = indexPath.size;
                app.logger.success('index updated');
                app.logger.info(indexPath.localPath, `${size}, ${zipped} zipped`);
            }
            // write the new manifest file.
            manifestPath.writeJson(manifest);
            let { size, zipped } = manifestPath.size;
            app.logger.success('manifest generated');
            app.logger.info(manifestPath.localPath, `${size}, ${zipped} zipped`);
        });
};

const FAVICONS = {
    FAVICON_16x16: {
        name: 'favicon-16x16.png',
        size: 16,
    },
    FAVICON_32x32: {
        name: 'favicon-32x32.png',
        size: 32,
    },
    FAVICON_192x192: {
        name: 'favicon-192x192.png',
        size: 192,
    },
    FAVICON_48x48: {
        name: 'favicon-48x48.png',
        size: 48,
    },
};

const MANIFEST_ICONS = {
    ANDROID_CHROME_36x36: {
        name: 'android-chrome-36x36.png',
        size: 36,
    },
    ANDROID_CHROME_48x48: {
        name: 'android-chrome-48x48.png',
        size: 48,
    },
    ANDROID_CHROME_72x72: {
        name: 'android-chrome-72x72.png',
        size: 72,
    },
    ANDROID_CHROME_96x96: {
        name: 'android-chrome-96x96.png',
        size: 96,
    },
    ANDROID_CHROME_144x144: {
        name: 'android-chrome-144x144.png',
        size: 144,
    },
    ANDROID_CHROME_192x192: {
        name: 'android-chrome-192x192.png',
        size: 192,
    },
    ANDROID_CHROME_256x256: {
        name: 'android-chrome-256x256.png',
        size: 256,
    },
    ANDROID_CHROME_384x384: {
        name: 'android-chrome-384x384.png',
        size: 384,
    },
    ANDROID_CHROME_512x512: {
        name: 'android-chrome-512x512.png',
        size: 512,
    },
};

const APPLE_ICONS = {
    APPLE_TOUCH_ICON: {
        name: 'apple-touch-icon.png',
        size: 180,
        background: { r: 255, g: 255, b: 255, alpha: 255 },
        gutter: 30,
    },
    APPLE_TOUCH_ICON_IPAD: {
        name: 'apple-touch-icon-ipad.png',
        size: 167,
        background: { r: 255, g: 255, b: 255, alpha: 255 },
        gutter: 30,
    },
};

/**
 * Generate icon files.
 * Update manifest and index.html.
 * @param {Object} manifest The original manifest object.
 * @param {DOMDocument} index The original index DOM document.
 * @param {NavigatorFile} icon The path to the master icon.
 * @param {NavigatorDirectory} root The download path for the generated icons.
 * @return {Promise<NavigatorDirectory>} Resolve the icons directory.
 */
async function generateIcons(manifest, index, icon, root) {
    const iconsPath = root.directory('icons');
    // create or empty the icons path.
    iconsPath.ensure();
    iconsPath.empty();

    // remove old favicons
    if (index) {
        index.querySelectorAll('[rel="icon"], [rel="shortcut icon"], [rel="apple-touch-icon"]').forEach((elem) => {
            elem.parentNode.removeChild(elem);
        });
    }

    let icons = await generateIcon(icon.path, iconsPath, MANIFEST_ICONS);
    let favicons = await generateIcon(icon.path, iconsPath, FAVICONS);
    let appleIcons = await generateIcon(icon.path, iconsPath, APPLE_ICONS);

    // update manifest icons
    manifest.icons = icons.map((file) => ({
        src: root.relative(file.src),
        sizes: `${file.size}x${file.size}`,
        type: 'image/png',
    }));

    // update favicons
    if (index) {
        favicons.forEach((file) => {
            index.head.innerHTML += `<link rel="icon" type="image/png" sizes="${file.size}x${file.size}" href="${root.relative(file.src)}">`;
        });
        index.head.innerHTML += `<link rel="shortcut icon" href="${root.relative(favicons[favicons.length - 1].src)}">`;
    }

    // update apple icons
    if (index) {
        index.head.innerHTML += `<link rel="apple-touch-icon" href="${root.relative(appleIcons[0].src)}">`;
        appleIcons.forEach((file) => {
            index.head.innerHTML += `<link rel="apple-touch-icon" sizes="${file.size}x${file.size}" href="${root.relative(file.src)}">`;
        });
    }

    return iconsPath;
}

/**
 * @typedef {Object} Color
 * @property {number} r Red value [0-255]
 * @property {number} g Green value [0-255]
 * @property {number} b Blue value [0-255]
 * @property {number} alpha Alpha value [0-255]
 */

/**
 * @typedef {Object} IconDescriptor
 * @property {string} name The filename
 * @property {number} size The size of the icon
 * @property {number} gutter The margin between the icon edge and the input image
 * @property {number} round The rounded corner value
 * @property {Color}  background The background color of the icon
 */

/**
 * Generate icons.
 *
 * @param {string} input The icon source image.
 * @param {NavigatorDirectory} output The output folder for generated icons.
 * @param {Object<string, IconDescriptor>} presets Custom presets configurations.
 * @return {Promise}
 */
function generateIcon(input, output, presets = {}) {
    const sharp = require('sharp');

    // ensure the output dir exists
    output.ensure();
    return Promise.all(
        Object.keys(presets).map(async (k) => {

            // merge preset options
            let options = Object.assign({}, presets[k]);
            let dest = output.file(options.name);
            // load the icon source
            let buffer = await sharp(input)
                // resize the image
                .resize(options.size - (options.gutter || 0))
                .png().toBuffer();

            // create the first level with the background color
            buffer = await sharp({
                create: {
                    width: options.size,
                    height: options.size,
                    channels: 4,
                    background: options.background || { r: 0, g: 0, b: 0, alpha: 0 },
                },
            })
                // add the icon
                .overlayWith(buffer, {
                    gravity: sharp.gravity.centre,
                    density: 300,
                })
                .png().toBuffer();

            if (options.round) {
                // mask the icon with an svg with rounded corners
                let roundedContent = `<svg><rect x="0" y="0" width="${options.size}" height="${options.size}" rx="${options.round}" ry="${options.round}"/></svg>`;
                let roundedCorners = Buffer.alloc(roundedContent.length, roundedContent);
                buffer = await sharp(buffer)
                    .overlayWith(roundedCorners, { cutout: true })
                    .png().toBuffer();
            }

            // save the file
            await sharp(buffer).toFile(dest.path);

            return {
                src: dest,
                size: options.size,
            };
        })
    );
}
