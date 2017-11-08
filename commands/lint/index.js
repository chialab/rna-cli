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

For style linting, it uses \`sass-lint\` (https://github.com/sasstools/sass-lint).
A default configuration is also provided in the config path of this module.
Anyway, the developer can use a custom configuration if the \`sass-lint.yml\` file exists in the root of the project.`)
        .option('<file1> <file2> <package1> <package2> <package3>', 'The packages or the files to lint.')
        .option('[--no-js]', 'Do not exec javascript linting.')
        .option('[--no-styles]', 'Do not exec style linting.')
        .option('[--no-warnings]', 'Do not check for warnings.')
        .action((app, options = {}) => require('./action')(app, options));
};
