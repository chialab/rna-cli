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
        .readme(`${__dirname}/README.md`)
        .option('<file|package>', 'The packages or the files to lint.')
        .option('[--fix]', 'Should autofix warnings.')
        .option('[--watch]', 'Watch files and re-lint on changes.')
        .action(async function lint(app, options) {
            const { isJSFile, isStyleFile, Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = new Project(cwd);

            let entries = [];
            if (options.arguments.length) {
                entries = project.resolve(options.arguments);
            } else {
                const workspaces = project.workspaces;
                if (workspaces) {
                    workspaces.forEach((ws) => {
                        let srcDirectory = ws.directories.src;
                        if (srcDirectory && srcDirectory.exists()) {
                            entries.push(...srcDirectory.resolve('**/*'));
                        } else if (ws.directory('src').exists()) {
                            entries.push(...ws.directory('src').resolve('**/*'));
                        }
                    });
                } else if (project.directories.src) {
                    entries.push(...project.directories.src.resolve('**/*'));
                } else if (project.directory('src').exists()) {
                    entries.push(...project.directory('src').resolve('**/*'));
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
    app.logger.play('running ESLint...');

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
    app.logger.play('running stylelint...');

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
