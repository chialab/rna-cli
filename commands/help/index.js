module.exports = (program) => {
    program
        .command('help')
        .description('Show CLI help.')
        .action((app, options = {}) => require('./action')(app, options));
};