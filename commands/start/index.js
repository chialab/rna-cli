module.exports = (program) => {
    program
        .command('start')
        .description('Update dependencies and serve the project.')
        .help('Start your dev session in seconds, running `bootstrap`, `watch` and `serve` commands.')
        .action((app, options) =>
            app.exec('bootstrap', options)
                .then(() => app.exec('build', options))
                .then((bundles) =>
                    app.exec('serve', options)
                        .then((serverInfo) => {
                            options.bundles = bundles;
                            options.exclude = options.exclude || serverInfo.config.server.baseDir;
                            return app.exec('watch', options)
                                .catch(() => {
                                    serverInfo.bs.exit();
                                });
                        })
                )
        );
};