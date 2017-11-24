const fs = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');
const rfg = require('rfg-api');

/**
 * Command action to generate icons.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {void}
 */
module.exports = (app, options) => {
    if (!options.arguments.length) {
        app.log(colors.red('missing icon.'));
        return global.Promise.reject();
    }
    if (!options.output) {
        app.log(colors.red('missing output.'));
        return global.Promise.reject();
    }
    const icon = path.resolve(process.cwd(), options.arguments[0]);
    const output = path.resolve(process.cwd(), options.output);
    const iconsPath = options.path || 'icons';
    if (!fs.existsSync(icon)) {
        app.log(`${colors.red('icon file not found.')} ${colors.grey(`(${icon})`)}`);
        return global.Promise.reject();
    }
    fs.ensureDirSync(output);
    fs.emptyDirSync(path.join(output, iconsPath));
    const api = rfg.init();
    let task = app.log('generating icons...', true);
    let manifest = undefined;
    if (options.manifest) {
        let manifestPath = path.resolve(process.cwd(), options.manifest);
        if (!fs.existsSync(manifestPath)) {
            app.log(`${colors.red('manifest file not found.')} ${colors.grey(`(${manifestPath})`)}`);
            return global.Promise.reject();
        }
        manifest = require(manifestPath);
    }
    return new global.Promise((resolve, reject) => {
        let request = {
            api_key: 'ca03a9fa1d054e0fd389f5ba6575e5a68c75b76c',
            master_picture: {
                type: 'inline',
                content: api.fileToBase64Sync(icon),
            },
            files_location: {
                type: 'path',
                path: iconsPath,
            },
            favicon_design: {
                desktop_browser: options.favicons !== false ? {} : undefined,
                ios: options.ios !== false ? {
                    picture_aspect: 'background_and_margin',
                    background_color: (manifest && (manifest.theme_color || manifest.background_color)) || '#fff',
                    margin: '14%',
                    assets: {
                        ios6_and_prior_icons: false,
                        ios7_and_later_icons: false,
                        precomposed_icons: true,
                        declare_only_default_icon: false,
                    },
                } : undefined,
                android_chrome: options.android !== false ? {
                    picture_aspect: 'no_change',
                    manifest: manifest ? { existing_manifest: JSON.stringify(manifest, null, 2) } : {},
                    assets: {
                        legacy_icon: true,
                        low_resolution_icons: true,
                    },
                } : undefined,
            },
            settings: {
                scaling_algorithm: 'Mitchell',
                error_on_image_too_small: false,
            },
        };
        api.generateFavicon(request, path.join(output, iconsPath), (err, res) => {
            task();
            if (err) {
                app.log(colors.red('error generating icons.'));
                reject(err);
            } else {
                let icons = res.favicon.files_urls
                    .filter((url) => url.indexOf('manifest.json') === -1)
                    .map((url) => path.join(iconsPath, path.basename(url)));
                app.log(colors.bold(colors.green('icons generated!')));
                app.log(colors.grey(`(${icons.join(')\n(')})`));
                let newManifest = path.join(output, iconsPath, 'manifest.json');
                if (fs.existsSync(newManifest)) {
                    let realManifest = path.join(output, 'manifest.json');
                    fs.writeFileSync(realManifest, fs.readFileSync(newManifest));
                    fs.unlinkSync(newManifest);
                    app.log(`${colors.bold(colors.green('menifest generated!'))} ${colors.grey(`(${realManifest})`)}`);
                }
                if (res.favicon.html_code) {
                    app.log(colors.yellow('remember to include'));
                    app.log(colors.grey(
                        res.favicon.html_code.replace(path.join(iconsPath, 'manifest.json'), '/manifest.json')
                    ));
                    app.log(colors.yellow('in your index.html file.'));
                }
                resolve(res);
            }
        });
    });
};
