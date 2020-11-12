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
            const { Project } = require('../../lib/File');

            if (!options.output) {
                throw new Error('missing \'output\' property');
            }

            const cwd = process.cwd();
            const project = await Project.init(cwd);

            let entries;
            if (options.arguments.length) {
                entries = await project.resolve(options.arguments);
            } else {
                // use cwd sources.
                const workspaces = project.workspaces;
                if (workspaces) {
                    entries = workspaces;
                } else {
                    entries = [project];
                }

                if (!entries.length) {
                    throw new Error('no files for documentation found');
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
                        throw new Error('no files for documentation found');
                    }
                    let output = entry.file(options.output);
                    if (!output.extname) {
                        output = project.directory(options.output).file(`${input.basename}.md`);
                    }
                    await generate(app, project, input, output, options);
                } else {
                    // process file
                    let output = project.file(options.output);
                    if (!output.extname) {
                        output = project.directory(options.output).file(`${entry.basename}.md`);
                    }
                    await generate(app, project, entry, output, options);
                }
            }
        });
};

/**
 * Generate the API reference file.
 *
 * @param {CLI} app The CLI intance.
 * @param {Project} project The current project.
 * @param {Entry} input An input code file.
 * @param {Entry} output The output file name.
 * @param {Object} options Template options.
 * @return {Promise}
 */
async function generate(app, project, input, output, options) {
    app.logger.play(`generating API references... (${project.relative(output)})`);
    // start the `documentation` task.
    try {
        const sourceFile = bundle(input.path);
        const template = templates.markdown;
        template(sourceFile, Object.assign({}, options, { out: output.path }));
        app.logger.stop();
        app.logger.success('documentation created', project.relative(output));
    } catch(err) {
        // ops.
        app.logger.stop();
        throw err;
    }
}
