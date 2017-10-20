module.exports = (program) => {
    program
        .command('publish')
        .description('Publish to NPM. 🆘')
        .action((app) => {
            app.log('`publish` is not implemented yet.'.white.bgRed);
        });
};