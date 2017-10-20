module.exports = (program) => {
    program
        .command('test')
        .description('Run project tests. 🆘')
        .action((app) => {
            app.log('`test` is not implemented yet.'.white.bgRed);
        });
};