const fs = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');
const inquirer = require('inquirer');
const cwd = require('../../lib/paths.js').cwd;
const Proteins = require('@chialab/proteins');

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
    const api = require('rfg-api').init();
    // for request configuration, @see https://realfavicongenerator.net/api/non_interactive_api
    let request = {
        api_key: 'ca03a9fa1d054e0fd389f5ba6575e5a68c75b76c',
        master_picture: {
            type: 'inline',
            content: api.fileToBase64Sync(icon),
        },
        files_location: {
            type: 'path',
            path: 'icons',
        },
        favicon_design: {
            desktop_browser: {},
            ios: {
                picture_aspect: 'background_and_margin',
                background_color: (manifest && (manifest.theme_color || manifest.background_color)) || '#fff',
                margin: '14%',
                assets: {
                    ios6_and_prior_icons: false,
                    ios7_and_later_icons: false,
                    precomposed_icons: true,
                    declare_only_default_icon: false,
                },
            },
            android_chrome: {
                picture_aspect: 'no_change',
                manifest: manifest ? { existing_manifest: JSON.stringify(manifest, null, 2) } : {},
                assets: {
                    legacy_icon: true,
                    low_resolution_icons: true,
                },
            },
        },
        settings: {
            scaling_algorithm: 'Mitchell',
            error_on_image_too_small: false,
        },
    };
    return new global.Promise((resolve, reject) => {
        api.generateFavicon(request, output, (err, res) => {
            if (err) {
                return reject(err);
            }
            // update manifest
            let apiManifest = path.join(output, 'manifest.json');
            manifest.icons = require(apiManifest).icons;
            fs.unlinkSync(apiManifest);
            // update index links
            if (index) {
                // `res.favicon.overlapping_markups` contains a list of selectors of elements to update/replace
                if (res.favicon.overlapping_markups) {
                    res.favicon.overlapping_markups
                        // sanitize selectors
                        .map((selector) => selector.replace(',sizes', '][sizes'))
                        // remove old elements
                        .forEach((selector) => {
                            let toRemove = index.querySelectorAll(selector) || [];
                            toRemove.forEach((elem) => {
                                elem.parentNode.removeChild(elem);
                            });
                        });
                }
                // `res.favicon.html_code` contains new html code for icons references
                if (res.favicon.html_code) {
                    index.head.innerHTML += res.favicon.html_code
                        // change manifest reference
                        .replace('href="icons/manifest.json"', 'href="manifest.json"');
                }
            }
            return resolve();
        });
    });
}

module.exports = function(app, options = {}) {
    if (options.arguments.length === 0) {
        // missing webapp path for the manifest.
        app.log(colors.red('missing webapp path.'));
        return global.Promise.reject();
    }
    let dir = path.resolve(cwd, options.arguments[0]);
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
    if (options.index) {
        // create a fake DOM document for the index.html
        const JSDOM = require('jsdom').JSDOM;
        indexPath = path.resolve(cwd, options.index);
        index = new JSDOM(
            fs.readFileSync(indexPath)
        ).window.document;
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
                // generate icons.
                const icon = path.resolve(cwd, options.icon);
                const iconsPath = path.join(dir, 'icons');
                if (!fs.existsSync(icon)) {
                    // provided icons does not exists.
                    app.log(`${colors.red('icon file not found.')} ${colors.grey(`(${icon})`)}`);
                    return global.Promise.reject();
                }
                // create or empty the icons path.
                fs.ensureDirSync(iconsPath);
                fs.emptyDirSync(iconsPath);
                // exec the request.
                let task = app.log('generating icons...', true);
                generatingIcons = generateIcons(manifest, index, icon, iconsPath)
                    .then(() => {
                        task();
                        app.log(`${colors.bold(colors.green('icons generated!'))} ${colors.grey(`(${iconsPath})`)}`);
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
