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
        .help(`For javascript linting, it uses \`eslint\` (https://eslint.org).
A default configuration is also provided in the config path of this module.
Anyway, the developer can use a custom configuration if the \`.eslintrc.yml\` file exists in the root of the project.
It supports \`.eslintignore\` too.

For style linting, it uses \`stylelint\` (https://stylelint.io/).
A default configuration is also provided in the config path of this module.
Anyway, the developer can use a custom configuration if the \`.stylelintrc\` file exists in the root of the project.`)
        .option('<file1> <file2> <package1> <package2> <package3>', 'The packages or the files to lint.')
        .option('[--watch]', 'Watch files and re-lint on changes.')
        .action(async function lint(app, options) {
            const Project = require('../../lib/Project');
            const { isJSFile, isStyleFile } = require('../../lib/extensions');
            const Watcher = require('../../lib/Watcher');

            const cwd = process.cwd();
            const project = new Project(cwd);

            let entries;
            if (options.arguments.length) {
                entries = project.resolve(options.arguments);
            } else {
                const workspaces = project.workspaces;
                if (workspaces) {
                    workspaces.forEach((ws) => {
                        let styleDirectory = ws.directories.src;
                        if (styleDirectory) {
                            entries.push(...styleDirectory.resolve('**/*'));
                        }
                    });
                } else {
                    let styleDirectory = project.directories.src;
                    if (styleDirectory) {
                        entries.push(...styleDirectory.resolve('**/*'));
                    }
                }
            }

            const jsFiles = entries
                .filter((entry) => isJSFile(entry.path))
                .map((entry) => entry.path);

            const styleFiles = entries
                .filter((entry) => isStyleFile(entry.path))
                .map((entry) => entry.path);

            if (jsFiles.length) {
                if (await eslint(app, project, jsFiles)) {
                    throw 'ESLint found some errors.';
                }
            }

            if (styleFiles.length) {
                if (await stylelint(app, project, styleFiles)) {
                    throw 'Stylelint found some errors';
                }
            }

            if (options.watch) {
                const watcher = new Watcher(cwd);

                watcher.watch(async () => {
                    await lint(app);
                });
            }
        });
};

/**
 * Lint JS files with ESlint.
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The current project.
 * @param {Array<string>} files The list of files to lint.
 */
async function eslint(app, project, files) {
    const ESLint = require('../../lib/Linters/ESLint.js');
    const profile = app.profiler.task('eslint');
    const task = app.log('running ESLint...', true);

    try {
        const linter = new ESLint(ESLint.detectConfig(app, project));
        const report = await linter.lint(files);
        if (report.errorCount || report.warningCount) {
            app.log(linter.report());
        }
        profile.end();
        task(); // Stop loader.
        if (report.errorCount) {
            return report;
        }
    } catch (err) {
        profile.end();
        task();
        throw err;
    }
}

/**
 * Run Stylelint.
 *
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The current project
 * @param {Array<string>} files The list of files to lint.
 */
async function stylelint(app, project, files) {
    const Stylelint = require('../../lib/Linters/Stylelint.js');
    const profile = app.profiler.task('stylelint');
    const task = app.log('running stylelint...', true);

    try {
        const linter = new Stylelint(Stylelint.detectConfig(app, project));
        const report = await linter.lint(files);
        if (report.errorCount || report.warningCount) {
            app.log(linter.report());
        }
        profile.end();
        task(); // Stop loader.
        if (report.errorCount) {
            return report;
        }
    } catch(err) {
        profile.end();
        task();
        throw err;
    }
}
