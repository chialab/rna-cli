/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('documentation')
        .description('Generate API references.')
        .option('--output', 'The markdown output directory.')
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
                    throw 'no files for documentation found.';
                }
            }

            // process entries
            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];

                if (entry instanceof Project) {
                    // process package
                    let output = entry.entry(options.output);
                    if (!output.extname) {
                        output = output.file(project.scopeModule);
                    }
                    let script = entry.get('module') ?
                        entry.file(entry.get('module')) :
                        entry.file(entry.get('main'));
                    await generate(
                        app,
                        [script.path],
                        output
                    );

                    continue;
                }

                // process file
                let output = project.entry(options.output);
                if (!output.extname) {
                    output = output.file(entry.basename.replace(entry.extname, '.md'));
                }
                await generate(
                    app,
                    [entry.path],
                    options.output
                );
                continue;
            }
        });
};

/**
 * Generate the API reference file.
 *
 * @param {CLI} app The CLI intance.
 * @param {Array<String>} sources A list of sources to parse.
 * @param {String} output The reference file name.
 * @return {Promise}
 */
async function generate(app, sources, output) {
    const fs = require('fs-extra');
    const path = require('path');
    const documentation = require('documentation');

    app.logger.play(`generating API references... (${output})`);
    // start the `documentation` task.
    try {
        let builder = await documentation.build(sources, {});
        // format the result using markdown.
        let contents = await documentation.formats.md(builder);
        // write the final result.
        fs.ensureDirSync(path.dirname(output));
        fs.writeFileSync(output, contents);
        app.logger.stop();
        app.logger.success('documentation created', output.localPath);
    } catch(err) {
        // ops.
        app.logger.stop();
        throw err;
    }
}
