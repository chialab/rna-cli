const { bundle, templates } = require('dts-apigen');

/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('documentate')
        .readme(`${__dirname}/README.md`)
        .description('Generate API references.')
        .option('<file>', 'The files to documentate.')
        .option('--output', 'The markdown output file.')
        .option('--mode [mode]', 'The mode to use for markdown documentation. Accepted values are `module` and `files`')
        .option('--header [content]', 'A custom header for markdown documentation')
        .option('--footer [content]', 'A custom footer for markdown documentation')
        .action(async (app, options) => {
            const Project = require('../../lib/Project.js');

            if (!options.output) {
                throw 'Missing \'output\' property.';
            }

            const cwd = process.cwd();
            const project = new Project(cwd);

            let entries;
            if (options.arguments.length) {
                entries = project.resolve(options.arguments);
            } else {
                // use cwd sources.
                const workspaces = project.workspaces;
                if (workspaces) {
                    entries = workspaces;
                } else {
                    entries = [project];
                }

                if (!entries.length) {
                    throw 'no files for documentation found';
                }
            }

            // process entries
            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];

                if (entry instanceof Project) {
                    // process package
                    const libFile = entry.get('lib') && entry.file(entry.get('lib'));
                    const moduleFile = entry.get('module') && entry.file(entry.get('module'));
                    const mainFile = entry.get('main') && entry.file(entry.get('main'));
                    const input = libFile || moduleFile || mainFile;
                    if (!input) {
                        throw 'no files for documentation found';
                    }
                    let output = entry.entry(options.output);
                    if (!output.extname) {
                        output = project.directory(options.output).file(input.basename.replace(input.extname, '.md'));
                    }
                    await generate(app, input, output, options);
                } else {
                    // process file
                    let output = project.entry(options.output);
                    if (!output.extname) {
                        output = project.directory(options.output).file(entry.basename.replace(entry.extname, '.md'));
                    }
                    await generate(app, entry, output, options);
                }
            }
        });
};

/**
 * Generate the API reference file.
 *
 * @param {CLI} app The CLI intance.
 * @param {NavigatorEntry} input An input code file.
 * @param {NavigatorEntry} output The output file name.
 * @param {Object} options Template options.
 * @return {Promise}
 */
async function generate(app, input, output, options) {
    app.logger.play(`generating API references... (${output.localPath})`);
    // start the `documentation` task.
    try {
        const sourceFile = bundle(input.path);
        const template = templates.markdown;
        template(sourceFile, Object.assign({}, options, { out: output.path }));
        app.logger.stop();
        app.logger.success('documentation created', output.localPath);
    } catch(err) {
        // ops.
        app.logger.stop();
        throw err;
    }
}
