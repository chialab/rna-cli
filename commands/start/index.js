module.exports = (program) => {
    program
        .command('start')
        .description('Update dependencies and serve the project.')
        .help('Start your dev session in seconds, running `bootstrap`, `watch` and `serve` commands.')
        .action((app, options) =>
            app.exec('bootstrap', options)
                .then(() => app.exec('serve', options))
                .then(() => app.exec('watch', options))
        );
};