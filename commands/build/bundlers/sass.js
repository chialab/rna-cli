const fs = require('fs-extra');
const path = require('path');
const paths = require('../../../lib/paths.js');
const colors = require('colors/safe');
const sass = require('sass');
const resolve = require('resolve');
const BundleManifest = require('../../../lib/bundle.js');
const ext = require('../../../lib/extensions.js');
const postcss = require('postcss');

/**
 * Generate a list of file paths with all style extensions.
 * @param {string} url
 * @return {Array<string>}
 */
function alternatives(url) {
    let res = path.extname(url) ?
        // url already has an extension.
        [url] :
        // remap the path with all style extensions.
        ext.STYLE_EXTENSIONS.map((ext) => `${url}${ext}`);
    // look for sass partials too.
    if (path.basename(url)[0] !== '_') {
        for (let i = 0, len = res.length; i < len; i++) {
            res.push(
                // add the _ for partial syntax
                path.join(
                    path.dirname(res[i]),
                    `_${path.basename(res[i])}`
                )
            );
        }
    }
    return res;
}

/**
 * @typedef {Object} ImporterResult
 * @property {string} [file] The url of the path to import.
 * @property {string} [contents] The contents of the file to import.
 */

/**
 * Create a scoped SASS resolver.
 */
function resolver() {
    const alreadyResolved = [];
    /**
     * Resolve the file path of an imported style.
     * @param {string} url The url to import.
     * @param {string} prev The url of the parent file.
     * @return {ImporterResult} The result of the import.
     */
    return function nodeResolver(url, prev) {
        let mod;
        if (url[0] === '~') {
            // some modules use ~ for node_modules import
            mod = url.substring(1);
        } else {
            // generate file alternatives starting from the previous path
            let toCheck = alternatives(path.join(path.dirname(prev), url));
            // find out existing file
            let resolved = toCheck.find((f) => fs.existsSync(f));
            if (resolved) {
                // the local file exists, node resolution is not required
                url = resolved;
            } else {
                // if file is a module
                mod = url;
            }
        }
        if (mod) {
            // generate alternatives for style starting from the module path
            // add package json check for `style` field.
            let toCheck = alternatives(mod).concat([path.join(mod, 'package.json')]);
            for (let i = 0, len = toCheck.length; i < len; i++) {
                let modCheck = toCheck[i];
                try {
                    // use node resolution to get the full file path
                    // it throws if the file does not exist.
                    let checked = resolve.sync(modCheck, {
                        basedir: path.dirname(prev) || process.cwd(),
                    });
                    if (path.extname(checked) === '.json') {
                        // package.json found
                        checked = fs.realpathSync(checked);
                        let json = require(checked);
                        if (json.style) {
                            // style field found.
                            url = path.join(path.dirname(checked), json.style);
                        } else if (json.main && ext.isStyleFile(json.main)) {
                            // try to use the main field if it is a css file.
                            url = path.join(path.dirname(checked), json.main);
                        }
                    } else {
                        // url found
                        url = checked;
                    }
                    if (url) {
                        // file found, stop the search.
                        break;
                    }
                } catch (ex) {
                    //
                }
            }
        }
        if (alreadyResolved.indexOf(url) !== -1) {
            // This file has been resolved already.
            // Skip it in order to avoid duplications.
            return {
                contents: '',
            };
        }
        alreadyResolved.push(url);
        if (path.extname(url) === '.css') {
            // if the file has css extension, return its contents.
            // (sass does not include css file using plain css import, so we have to pass the content).
            return {
                contents: fs.readFileSync(url, 'utf8'),
            };
        }
        // return the found url.
        return {
            file: url,
        };
    };
}

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
        let postCssPlugins = [
            require('autoprefixer')(options.targets),
            require('postcss-all-unset'),
        ];
        if (options.production) {
            postCssPlugins.push(require('cssnano')({
                discardUnused: false,
                reduceIdents: false,
                zindex: false,
            }));
        }
        fs.ensureDirSync(path.dirname(options.output));
        sass.render({
            file: options.input,
            outFile: options.output,
            sourceMap: options.map !== false,
            sourceMapEmbed: options.map !== false,
            importer: resolver(),
        }, (err, sassResult) => {
            task();
            if (err) {
                app.log(err);
                app.log(colors.red(`sass error ${options.name}`));
                reject();
            } else {
                profile.end();
                profile = profiler.task('postcss');
                postcss(postCssPlugins)
                    .process(sassResult.css.toString(), {
                        from: options.input,
                        to: options.output,
                        map: options.map !== false,
                    })
                    .then((result) => {
                        fs.writeFileSync(options.output, result.css);
                        if (options.map !== false && result.map) {
                            fs.writeFileSync(`${options.output}.map`, result.map);
                        }
                        app.log(`${colors.bold(colors.green('sass done!'))} ${colors.grey(`(${options.output})`)}`);
                        profile.end();
                        let manifest = new BundleManifest(options.input, options.output);
                        if (sassResult.stats && sassResult.stats.includedFiles) {
                            manifest.addFile(...sassResult.stats.includedFiles);
                        }
                        resolve(manifest);
                    });
            }
        });
    });
};
