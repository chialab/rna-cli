const fs = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../lib/paths.js');
const documentation = require('documentation');
const Entry = require('../../lib/entry.js');

/**
 * Generate the API reference file.
 *
 * @param {CLI} app The CLI intance.
 * @param {Array<String>} sources A list of sources to parse.
 * @param {String} output The reference file name.
 * @return {Promise}
 */
function generate(app, sources, output) {
    let task = app.log(`generating API references... (${output})`, true);
    // start the `documentation` task.
    return documentation.build(sources, {})
        // format the result using markdown.
        .then(documentation.formats.md)
        .then((contents) => {
            // write the final result.
            fs.ensureDirSync(path.dirname(output));
            fs.writeFileSync(output, contents);
            task();
            app.log(`${colors.bold(colors.green('API references created.'))} ${colors.grey(`(${output})`)}`);
            return global.Promise.resolve();
        })
        .catch((err) => {
            // ops.
            task();
            if (err) {
                app.log(err);
            }
            app.log(`${colors.red('failed to generate API references.')} ${colors.grey(`(${output})`)}`);
            return global.Promise.reject();
        });
}

/**
 * Command action to run linter.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    let entries = Entry.resolve(options.arguments);
    if (!entries.length) {
        // no arguments
        if (!paths.cwd) {
            // Unable to detect project root.
            app.log(colors.red('no project found.'));
            return global.Promise.reject();
        } else {
            // use cwd sources.
            entries = Entry.resolve(path.join(paths.cwd, 'src/**/*.js'));
        }
    }

    if (!options.output) {
        app.log(colors.red('missing \'output\' property.'));
        return global.Promise.reject();
    }

    let promise = global.Promise.resolve();

    // process entries
    entries.forEach((entry) => {
        if (entry.file) {
            // process file
            let output = path.resolve(paths.cwd, options.output);
            if (!path.extname(output)) {
                // `output` options is a folder
                output = path.join(output, `${path.basename(entry.file.path, path.extname(entry.file.path))}.md`);
            }
            promise = promise.then(() => generate(
                app,
                [entry.file.path],
                options.output
            ));
        } else {
            // process package
            let output = path.resolve(entry.package.path, options.output);
            if (!path.extname(output)) {
                // `output` options is a folder
                let shortName = entry.package.name.split('/')[1];
                // generate a file with the name of the package.
                output = path.join(output, `${shortName.toLowerCase()}.md`);
            }
            promise = promise.then(() => generate(
                app,
                [path.join(entry.package.path, entry.package.json.module || entry.package.json.main)],
                output
            ));
        }
    });

    return promise;
};
