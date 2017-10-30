const fs = require('fs');
const path = require('path');
const paths = require('../../../lib/paths.js');
const colors = require('colors/safe');
const sass = require('node-sass');
const resolve = require('resolve');
const STYLE_EXTENSIONS = ['.scss', '.sass', '.css'];

function alternatives(url) {
    let res = path.extname(url) ?
        [url] :
        STYLE_EXTENSIONS.map((ext) => `${url}${ext}`);
    if (path.basename(url) !== '_') {
        for (let i = 0, len = res.length; i < len; i++) {
            res.push(
                path.join(
                    path.dirname(res[i]),
                    `_${path.basename(res[i])}`
                )
            );
        }
    }
    return res;
}

function nodeResolver(url, prev, options) {
    let mod;
    let includePaths = options.includePaths;
    if (!url.match(/^[./]/)) {
        if (url[0] === '~') {
            mod = url.substring(1);
        } else {
            let toCheck = alternatives(path.join(path.dirname(prev), url));
            let resolved = toCheck.find((f) => fs.existsSync(f));
            if (resolved) {
                url = resolved;
            } else {
                mod = url;
            }
        }
    }
    if (mod) {
        let toCheck = alternatives(mod);
        let ok = false;
        toCheck.forEach((modCheck) => {
            if (!ok) {
                try {
                    url = resolve.sync(modCheck, {
                        basedir: path.dirname(prev) || process.cwd(),
                    });
                    let base = path.join(url.replace(modCheck, ''), '**/*');
                    if (includePaths.indexOf(base) === -1) {
                        includePaths.push(base);
                    }
                    ok = true;
                } catch (ex) {
                    //
                }
            }
        });
    } else if (!path.isAbsolute(url)) {
        let toCheck = alternatives(path.resolve(path.dirname(prev), url));
        url = toCheck.find((f) => fs.existsSync(f));
    }
    return {
        file: url,
        contents: options ? fs.readFileSync(url, 'utf8') : '',
    };
}

module.exports = (app, options) => {
    let prev = app.generatedOptions[options.input];
    if (prev) {
        options = app.generatedOptions[options.input];
    } else if (options.output) {
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
        let task = app.log(`sass${app.generated[options.input] ? ' [this will be fast]' : ''}... ${colors.grey(`(${options.input})`)}`, true);
        options.includePaths = options.includePaths || [];
        sass.render({
            file: options.input,
            data: fs.readFileSync(options.input, 'utf8'),
            outFile: options.output,
            sourceMap: options.map !== false,
            sourceMapEmbed: options.map !== false,
            outputStyle: options.production ? 'compressed' : 'expanded',
            importer: (url, prev) => nodeResolver(url, prev, options),
            includePaths: options.includePaths,
        }, (err, result) => {
            task();
            if (err) {
                app.log(err);
                app.log(colors.red(`sass error ${options.name}`));
                reject(err);
            } else {
                fs.writeFileSync(options.output, result.css.toString());
                app.generated[options.input] = {
                    modules: [
                        {
                            dependencies: result.stats.includedFiles || [],
                        },
                    ],
                };
                app.generatedOptions[options.input] = options;
                app.log(`${colors.bold(colors.green('sass done!'))} ${colors.grey(`(${options.output})`)}`);
                resolve();
            }
        });
    });
};