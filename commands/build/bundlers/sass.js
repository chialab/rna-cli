const fs = require('fs-extra');
const path = require('path');
const paths = require('../../../lib/paths.js');
const colors = require('colors/safe');
const sass = require('sass');
const BundleManifest = require('../../../lib/bundle.js');
const postcss = require('postcss');
const resolver = require('../plugins/sass-resolver/sass-resolver');

/**
 * Command action to run linter.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 *
 * @namespace options
 * @property {string} input The sass source file.
 * @property {string} output The file to create.
 * @property {Boolean} map Should generate sourcemaps.
 * @property {Boolean} production Should generate files in production mode.
 */
module.exports = (app, options, profiler) => {
    if (options.output) {
        options.output = path.resolve(paths.cwd, options.output);
        let final = options.output.split(path.sep).pop();
        if (!final.match(/\./)) {
            options.output = path.join(
                options.output,
                path.basename(options.input)
            );
        }
    }
    return new global.Promise((resolve, reject) => {
        let profile = profiler.task('sass');
        let task = app.log(`sass... ${colors.grey(`(${options.input})`)}`, true);
        fs.ensureDirSync(path.dirname(options.output));
        try {
            const sassResult = sass.renderSync({
                file: options.input,
                outFile: options.output,
                sourceMap: options.map !== false ? true : false,
                sourceMapContents: true,
                sourceMapEmbed: false,
                importer: resolver(),
            });
            profile.end();
            profile = profiler.task('postcss');
            let postCssPlugins = [
                require('autoprefixer')({
                    browsers: options.targets,
                    grid: true,
                    flexbox: true,
                    remove: false,
                }),
                require('postcss-all-unset'),
            ];
            if (options.production) {
                postCssPlugins.push(require('cssnano')({
                    discardUnused: false,
                    reduceIdents: false,
                    zindex: false,
                }));
            }
            postcss(postCssPlugins)
                .process(sassResult.css.toString(), {
                    from: options.input,
                    to: options.output,
                    map: options.map !== false ? {
                        inline: options.map === 'inline',
                        prev: JSON.parse(sassResult.map.toString()),
                        sourcesContent: true,
                    } : false,
                })
                .then((result) => {
                    fs.writeFileSync(options.output, result.css);
                    if (options.map !== false && options.map !== 'inline' && result.map) {
                        fs.writeFileSync(`${options.output}.map`, result.map);
                    }
                    app.log(`${colors.bold(colors.green('sass done!'))} ${colors.grey(`(${options.output})`)}`);
                    resolver.clear();
                    task();
                    profile.end();
                    let manifest = new BundleManifest(options.input, options.output);
                    if (sassResult.stats && sassResult.stats.includedFiles) {
                        manifest.addFile(...sassResult.stats.includedFiles);
                    }
                    resolve(manifest);
                })
                .catch((err) => {
                    resolver.clear();
                    task();
                    profile.end();
                    if (err) {
                        app.log(err);
                        app.log(`${colors.red('postcss error')} ${colors.grey(`(${options.output})`)}`);
                    }
                    reject();
                });
        } catch (err) {
            resolver.clear();
            task();
            profile.end();
            if (err) {
                app.log(err);
                app.log(`${colors.red('sass error')} ${colors.grey(`(${options.output})`)}`);
            }
            reject();
        }
    });
};
