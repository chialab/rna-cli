/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('watch')
        .description('Watch project files.')
        .help(`It uses \`chokidar\` to watch the project files changes, additions or remotions.
Everytime a change has been triggered, it runs the \`lint\` and \`build\` commands.`)
        .option('<file1> <file2> <package1> <package2> <package3>', 'The packages or files to watch.')
        .option('[--exclude]', 'Files to exclude (string, glob, array).')
        .option('[--no-lint]', 'Disable lint on changes.')
        .option('[--no-build]', 'Disable build on changes.')
        .action((app, options = {}) => require('./action')(app, options));
};
