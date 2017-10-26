module.exports = (program) => {
    program
        .command('serve')
        .description('Setup a server for your project.')
        .option('[file]', 'The server directory.')
        .option('--port', 'The server port.')
        .option('--watch', 'Should watch server directory.')
        .option('--directory', 'Should list directories.')
        .action((app, options = {}) => require('./action')(app, options));
};