/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('lint')
        .description('Lint your source files.')
        .deprecate('4.0.0', 'Use configuration presets.')
        .readme(`${__dirname}/README.md`)
        .option('<file|package>', 'The packages or the files to lint.')
        .option('[--fix]', 'Should autofix warnings.')
        .option('[--watch]', 'Watch files and re-lint on changes.')
        .action(async function lint(app, options) {
            const { isJSFile, isStyleFile, Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = await Project.init(cwd);

            let entries = [];
            if (options.arguments.length) {
                entries = await project.resolve(options.arguments);
            } else {
                let workspaces = await project.getWorkspaces();
                if (workspaces) {
                    await Promise.all(
                        workspaces.map(async (ws) => {
                            let srcDirectory = ws.directories.src;
                            if (srcDirectory && await srcDirectory.exists()) {
                                let subEntries = await srcDirectory.resolve('**/*');
                                entries.push(...subEntries);
                            } else if (await ws.directory('src').exists()) {
                                let subEntries = await ws.directory('src').resolve('**/*');
                                entries.push(...subEntries);
                            }
                        })
                    );
                } else if (project.directories.src) {
                    let subEntries = await project.directories.src.resolve('**/*');
                    entries.push(...subEntries);
                } else if (await project.directory('src').exists()) {
                    let subEntries = await project.directory('src').resolve('**/*');
                    entries.push(...subEntries);
                }
            }

            if (entries.length === 0) {
                throw new Error('missing files to lint');
            }

            const jsFiles = entries
                .filter((entry) => isJSFile(entry.path))
                .map((entry) => entry.path);

            const styleFiles = entries
                .filter((entry) => isStyleFile(entry.path))
                .map((entry) => entry.path);

            let exitCode = 0;
            if (jsFiles.length) {
                const report = await eslint(app, project, { fix: options.fix }, jsFiles);
                if (report) {
                    exitCode = 1;
                }
            }

            if (styleFiles.length) {
                const report = await stylelint(app, project, { fix: options.fix }, styleFiles);
                if (report) {
                    exitCode = 1;
                }
            }

            if (options.watch) {
                let requested = false;
                let running = false;
                let timeout;

                const reLint = async (isRequest) => {
                    if (running && isRequest) {
                        requested = true;
                        return;
                    } else if (!requested) {
                        return;
                    }
                    requested = false;
                    running = true;
                    await lint(app, options);
                    running = false;
                    reLint();
                };

                project.watch(() => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        requested = true;
                        reLint(true);
                    }, 200);
                });

                return;
            }

            if (exitCode === 0) {
                app.logger.success('everything is fine');
            }

            return exitCode;
        });
};

/**
 * Lint JS files with ESlint.
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The current project.
 * @param {Object} options The linter options.
 * @param {Array<string>} files The list of files to lint.
 */
async function eslint(app, project, options, files) {
    const ESLint = require('../../lib/Linters/ESLint');

    try {
        const linter = new ESLint();
        await linter.setup(project, options);
        const report = await linter.lint(files);
        if (report.errorCount || report.warningCount) {
            app.logger.log(ESLint.format(linter.result));
        }
        app.logger.stop();
        if (report.errorCount) {
            return report;
        }
    } catch (err) {
        app.logger.stop();
        throw err;
    }
}

/**
 * Run Stylelint.
 *
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The current project.
 * @param {Object} options The linter options.
 * @param {Array<string>} files The list of files to lint.
 */
async function stylelint(app, project, options, files) {
    const Stylelint = require('../../lib/Linters/Stylelint');

    try {
        const linter = new Stylelint();
        await linter.setup(project, options);
        const report = await linter.lint(files);
        if (report.errorCount || report.warningCount) {
            app.logger.log(Stylelint.format(linter.result));
        }
        app.logger.stop();
        if (report.errorCount) {
            return report;
        }
    } catch(err) {
        app.logger.stop();
        throw err;
    }
}
