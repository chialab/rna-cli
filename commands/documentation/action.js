const fs = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');
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
async function generate(app, sources, output) {
    let task = app.log(`generating API references... (${output})`, true);
    // start the `documentation` task.
    try {
        let builder = await documentation.build(sources, {});
        // format the result using markdown.
        let contents = await documentation.formats.md(builder);
        // write the final result.
        fs.ensureDirSync(path.dirname(output));
        fs.writeFileSync(output, contents);
        task();
        app.log(`${colors.bold(colors.green('API references created.'))} ${colors.grey(`(${output})`)}`);
    } catch(err) {
        // ops.
        task();
        throw err;
    }
}

/**
 * Command action to run linter.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function docs(app, options) {
    const cwd = process.cwd();

    let entries = Entry.resolve(cwd, options.arguments);
    if (!entries.length) {
        // no arguments
        if (!cwd) {
            // Unable to detect project root.
            throw 'No project found.';
        }
        // use cwd sources.
        entries = Entry.resolve(cwd, path.join(cwd, 'src/**/*.js'));
    }

    if (!options.output) {
        throw 'Missing \'output\' property.';
    }

    // process entries
    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];

        if (entry.file) {
            // process file
            let output = path.resolve(cwd, options.output);
            if (!path.extname(output)) {
                // `output` options is a folder
                output = path.join(output, `${path.basename(entry.file.path, path.extname(entry.file.path))}.md`);
            }
            await generate(
                app,
                [entry.file.path],
                options.output
            );
            continue;
        }
        // process package
        let output = path.resolve(entry.package.path, options.output);
        if (!path.extname(output)) {
            // `output` options is a folder
            let shortName = entry.package.name.split('/')[1];
            // generate a file with the name of the package.
            output = path.join(output, `${shortName.toLowerCase()}.md`);
        }
        await generate(
            app,
            [path.join(entry.package.path, entry.package.json.module || entry.package.json.main)],
            output
        );
    }
};
