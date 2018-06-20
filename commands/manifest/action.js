const fs = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');
const inquirer = require('inquirer');
const cwd = require('../../lib/paths.js').cwd;
const Proteins = require('@chialab/proteins');

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
};

/**
 * Setup manifest default fields.
 * @param {Object} manifest The original manifest object.
 * @param {Object} json The package json object.
 * @return void
 */
function defaults(manifest, json = {}) {
    manifest.name = manifest.name || json.name || path.basename(cwd);
    manifest.short_name = manifest.short_name || manifest.name || json.name || path.basename(cwd);
    manifest.description = manifest.description || json.description;
    manifest.start_url = manifest.start_url || '.';
    manifest.scope = manifest.scope || '/';
    manifest.display = manifest.display || 'standalone';
    manifest.orientation = manifest.orientation || 'any';
    manifest.theme_color = manifest.theme_color || '#000';
    manifest.background_color = manifest.background_color || '#fff';
    manifest.lang = manifest.lang || 'en-US';
}

/**
 * Use realfavicongenerator apis for icons generation.
 * Update manifest and index.html.
 * @param {Object} manifest The original manifest object.
 * @param {DOMDocument} index The original index DOM document.
 * @param {String} icon The path to the master icon.
 * @param {String} output The download path for the generated icons.
 * @return {Promise}
 */
function generateIcons(manifest, index, icon, output) {
    const generator = require('./lib/icons.js');
    const iconsPath = path.join(output, 'icons');
    // create or empty the icons path.
    fs.ensureDirSync(iconsPath);
    fs.emptyDirSync(iconsPath);

    // remove old favicons
    if (index) {
        index.querySelectorAll('[rel="icon"], [rel="shortcut icon"], [rel="apple-touch-icon"]').forEach((elem) => {
            elem.parentNode.removeChild(elem);
        });
    }

    return Promise.all([
        generator(icon, iconsPath, MANIFEST_ICONS)
            .then((icons) => {
                // update manifest icons
                manifest.icons = icons.map((file) => ({
                    src: path.relative(output, file.src),
                    sizes: `${file.size}x${file.size}`,
                    type: 'image/png',
                }));
            }),
        generator(icon, iconsPath, FAVICONS)
            .then((favicons) => {
                // update favicons
                if (index) {
                    favicons.forEach((file) => {
                        index.head.innerHTML += `<link rel="icon" type="image/png" sizes="${file.size}x${file.size}" href="${path.relative(output, file.src)}">`;
                    });
                    index.head.innerHTML += `<link rel="shortcut icon" href="${path.relative(output, favicons[favicons.length - 1].src)}">`;
                }
            }),
        generator(icon, iconsPath, APPLE_ICONS)
            .then((appleIcons) => {
                // update apple icons
                if (index) {
                    appleIcons.forEach((file) => {
                        index.head.innerHTML += `<link rel="apple-touch-icon" sizes="${file.size}x${file.size}" href="${path.relative(output, file.src)}">`;
                    });
                }
            }),
    ]);
}

module.exports = function(app, options = {}) {
    if (options.arguments.length === 0) {
        // missing webapp path for the manifest.
        app.log(colors.red('missing webapp path.'));
        return global.Promise.reject();
    }
    let dir = path.resolve(cwd, options.arguments[0]);
    if (!fs.statSync(dir).isDirectory()) {
        // the webapp path is not a directory.
        app.log(colors.red('webapp path is not a directory.'));
        return global.Promise.reject();
    }
    // default manifest path.
    let manifestPath = path.join(dir, 'manifest.json');
    if (options.output) {
        // use output flag if defined.
        manifestPath = options.output;
    }
    let manifest = {};
    if (!options.manifest && fs.existsSync(manifestPath)) {
        // if a manifest already exists, use it.
        options.manifest = manifestPath;
    }
    if (options.manifest) {
        // use the manifest flag as source for the new manifest.
        try {
            manifest = require(path.resolve(cwd, options.manifest));
        } catch (err) {
            // invalid manifest.
            app.log(colors.red('invalid source manifest.'));
            return global.Promise.reject(err);
        }
    }

    // collect package json metadata.
    let jsonPath = path.join(cwd, 'package.json');
    let json = {};
    if (fs.existsSync(jsonPath)) {
        try {
            json = require(jsonPath);
        } catch (err) {
            // invalid package json
        }
    }

    // collect index data if provided by flag.
    let index;
    let indexPath;
    const JSDOM = require('jsdom').JSDOM;
    // create a fake DOM document for the index.html
    if (typeof options.index === 'string') {
        indexPath = path.resolve(cwd, options.index);
        index = new JSDOM(
            fs.readFileSync(indexPath)
        ).window.document;
    } else if (options.index !== false) {
        // try to auto detect index.html
        indexPath = path.resolve(cwd, 'index.html');
        if (fs.existsSync(indexPath)) {
            index = new JSDOM(
                fs.readFileSync(indexPath)
            ).window.document;
        }
    }

    // set manifest defaults
    defaults(manifest, json);

    let fillManifest = global.Promise.resolve();
    if (!options.ci && !process.env.CI) {
        // create the prompt.
        const formatQuestion = (msg) => `${colors.cyan('manifest')} > ${msg}:`;
        const prompt = inquirer.createPromptModule();
        // @see https://developer.mozilla.org/en-US/docs/Web/Manifest
        fillManifest = prompt([
            {
                type: 'input',
                name: 'name',
                message: formatQuestion('name'),
                default: manifest.name,
            },
            {
                type: 'input',
                name: 'shot_name',
                message: formatQuestion('short mame'),
                default: manifest.short_name,
            },
            {
                type: 'input',
                name: 'description',
                message: formatQuestion('description'),
                default: manifest.description,
            },
            {
                type: 'input',
                name: 'start_url',
                message: formatQuestion('start url'),
                default: manifest.start_url,
            },
            options.scope ? undefined : {
                type: 'input',
                name: 'scope',
                message: formatQuestion('scope'),
                default: manifest.scope,
            },
            {
                type: 'list',
                name: 'display',
                message: formatQuestion('display'),
                choices: ['standalone', 'fullscreen', 'minimal-ui', 'browser'],
                default: ['standalone', 'fullscreen', 'minimal-ui', 'browser'].indexOf(manifest.display),
            },
            {
                type: 'list',
                name: 'orientation',
                message: formatQuestion('orientation'),
                choices: ['any', 'natural', 'landscape', 'landscape-primary', 'landscape-secondary', 'portrait', 'portrait-primary', 'portrait-secondary'],
                default: ['any', 'natural', 'landscape', 'landscape-primary', 'landscape-secondary', 'portrait', 'portrait-primary', 'portrait-secondary'].indexOf(manifest.orientation),
            },
            {
                type: 'input',
                name: 'theme_color',
                message: formatQuestion('main color'),
                default: manifest.theme_color,
            },
            {
                type: 'input',
                name: 'background_color',
                message: formatQuestion('main background'),
                default: manifest.background_color,
            },
            {
                type: 'input',
                name: 'lang',
                message: formatQuestion('default lang'),
                default: manifest.lang,
            },
        ].filter((cmd) => !!cmd) /* filter active commands */).then((answers) => {
            // merge answers with the current manifest.
            manifest = Proteins.merge(manifest, answers);
            return global.Promise.resolve();
        });
    }

    return fillManifest
        .then(() => {
            let generatingIcons = global.Promise.resolve();
            if (options.icon) {
                if (typeof options.icon !== 'string') {
                    // the webapp path is not a directory.
                    app.log(colors.red('missing icon path.'));
                    return global.Promise.reject();
                }
                // generate icons.
                const icon = path.resolve(cwd, options.icon);
                if (!fs.existsSync(icon)) {
                    // provided icons does not exists.
                    app.log(`${colors.red('icon file not found.')} ${colors.grey(`(${icon})`)}`);
                    return global.Promise.reject();
                }
                // exec the request.
                let task = app.log('generating icons...', true);
                generatingIcons = generateIcons(manifest, index, icon, dir)
                    .then(() => {
                        task();
                        app.log(`${colors.bold(colors.green('icons generated!'))} ${colors.grey(`(${dir}/icons)`)}`);
                        return global.Promise.resolve();
                    }).catch((err) => {
                        task();
                        app.log(`${colors.red('error generting icons.')} ${colors.grey(`(${icon})`)}`);
                        return global.Promise.reject(err);
                    });
            }
            return generatingIcons;
        })
        .then(() => {
            if (options.scope) {
                manifest.scope = options.scope;
            }
            if (manifest.scope && index) {
                // update index <base> using manifest.scope
                let base = index.querySelector('base') || index.createElement('base');
                base.setAttribute('href', manifest.scope);
                index.head.appendChild(base);
            }
            // write the new manifest file.
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            app.log(`${colors.bold(colors.green('manifest generated.'))} ${colors.grey(`(${manifestPath})`)}`);
            if (index) {
                // beautify html
                let html = require('js-beautify').html(
                    index.documentElement.outerHTML, {
                        indent_size: 4,
                        indent_char: ' ',
                        preserve_newlines: false,
                    }
                );
                fs.writeFileSync(indexPath, `<!DOCTYPE html>\n${html}`);
                app.log(`${colors.bold(colors.green('index updated.'))} ${colors.grey(`(${indexPath})`)}`);
            }
            return global.Promise.resolve();
        })
        .catch((err) => {
            // ops.
            app.log(colors.red('error generating manifest.'));
            return global.Promise.reject(err);
        });
};
