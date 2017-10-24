const fs = require('fs');
const path = require('path');
const glob = require('glob');
const colors = require('colors/safe');
const Linter = require('eslint').CLIEngine;
const SassLinter = require('sass-lint');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');

function getConfig() {
    let localConf = path.join(paths.cwd, '.eslintrc.yml');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
    return path.join(paths.cli, 'configs/lint/eslintrc.yml');
}

function eslintTask(app, sourceFiles, options) {
    if (options.js !== false && sourceFiles.length) {
        let configFile = getConfig();
        let jsFiles = [];
        sourceFiles
            .filter((src) => fs.existsSync(src))
            .filter((src) => !fs.statSync(src).isFile() || src.match(/\.jsx?$/i))
            .forEach((src) => {
                if (fs.statSync(src).isFile()) {
                    jsFiles.push(src);
                } else {
                    jsFiles.push(...glob.sync(
                        path.join(src, 'src/**/*.{js,jsx}')
                    ));
                }
            });
        if (jsFiles.length) {
            let task = app.log('running ESLint...', true);
            const linter = new Linter({
                configFile,
                cwd: paths.cwd,
            });
            const report = linter.executeOnFiles(jsFiles);
            task();
            if (report.errorCount || report.warningCount) {
                const formatter = linter.getFormatter();
                app.log(formatter(report.results));
                return global.Promise.resolve(
                    (options.warnings !== false || report.errorCount) ? report : undefined
                );
            }
            app.log(colors.bold('👮  everything is fine with ESLint.'));
            return global.Promise.resolve();
        }
    }
    return global.Promise.resolve();
}

function sasslintTask(app, sourceFiles, options) {
    if (options.styles !== false && sourceFiles.length) {
        let task = app.log('running SassLint...', true);
        let sassFiles = [];
        sourceFiles
            .filter((src) => fs.existsSync(src))
            .filter((src) => !fs.statSync(src).isFile() || src.match(/\.(css|sass|scss)$/i))
            .forEach((src) => {
                if (fs.statSync(src).isFile()) {
                    sassFiles.push(src);
                } else {
                    sassFiles.push(...glob.sync(
                        path.join(src, 'src/**/*.{scss,sass,css}')
                    ));
                }
            });
        if (sourceFiles.length) {
            let reports = [];
            sassFiles.forEach((src) => {
                let report = SassLinter.lintFiles(src, {});
                report.forEach((r) => {
                    if (r.errorCount) {
                        reports.push(r);
                    } else if (r.warningCount && options.warnings !== false) {
                        reports.push(r);
                    }
                });
            });
            task();
            if (reports.length) {
                SassLinter.outputResults(reports);
                return global.Promise.resolve(reports);
            }
            app.log(colors.bold('👮  everything is fine with SassLint.'));
        }
    }
    return global.Promise.resolve();
}

module.exports = (program) => {
    program
        .command('lint')
        .description('Lint your source files.')
        .help(`For javascript linting, it uses \`eslint\` (https://eslint.org).
A default configuration is also provided in the config path of this module.
Anyway, the developer can use a custom configuration if the \`.eslintrc.yml\` file exists in the root of the project.
It supports \`.eslintignore\` too.

For style linting, it uses \`sass-lint\` (https://github.com/sasstools/sass-lint).
A default configuration is also provided in the config path of this module.
Anyway, the developer can use a custom configuration if the \`sass-lint.yml\` file exists in the root of the project.`)
        .option('[file1] [file2] [package1] [package2] [package3]', 'The packages or the files to lint.')
        .option('--no-js', 'Do not exec javascript linting.')
        .option('--no-styles', 'Do not exec style linting.')
        .option('--no-warnings', 'Do not check for warnings.')
        .action((app, options) => {
            if (!paths.cwd) {
                app.log(colors.red('no project found.'));
                return global.Promise.reject();
            }
            let filter = optionsUtils.handleArguments(options);
            let toLint = filter.files.concat(Object.values(filter.packages).map((pkg) => pkg.path));
            return eslintTask(app, toLint, options)
                .then((eslintRes) => {
                    let res = eslintRes ? [eslintRes] : [];
                    return sasslintTask(app, toLint, options)
                        .then((sassRes) => {
                            if (sassRes) {
                                res.push(sassRes);
                            }
                            return global.Promise.resolve(res);
                        });
                });
        });
};