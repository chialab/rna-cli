const fs = require('fs');
const path = require('path');
const paths = require('../../../lib/paths.js');
const colors = require('colors/safe');
const sass = require('node-sass');

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
        sass.render({
            file: options.input,
            data: fs.readFileSync(options.input, 'utf8'),
            outFile: options.output,
            sourceMap: options.map !== false,
            sourceMapEmbed: options.map !== false,
            outputStyle: options.production ? 'compressed' : 'expanded',
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