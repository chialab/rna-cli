module.exports = (program) => {
    program
        .command('setup')
        .description('Setup a new project. 🆘')
        .action((app) => {
            app.log('`setup` is not implemented yet.'.white.bgRed);
        });
};