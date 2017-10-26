module.exports = (program) => {
    program
        .command('bootstrap')
        .description('Sync project dependencies after a project update or a git pull.')
        .help('A simple alias to `yarn install` command.')
        .action((app, options = {}) => require('./action')(app, options));
};