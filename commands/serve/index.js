/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('serve')
        .description('Setup a server for your project.')
        .readme(`${__dirname}/README.md`)
        .option('<path>', 'The server directory.')
        .option('[--port]', 'The server port.')
        .option('[--watch]', 'Should watch server directory.')
        .option('[--tunnel]', 'Create a tunnel for the server.')
        .option('[--directory]', 'Should list directories.')
        .option('[--https]', 'Start a server using SSL.')
        .option('[--compress]', 'Activate gzip compression on static files.')
        .action(async (app, options = {}) => {
            const { mix } = require('@chialab/proteins');
            const { Project } = require('../../lib/File');
            const Server = require('../../lib/Servers/Server');

            const cwd = process.cwd();
            const project = new Project(cwd);

            // Load directory to be served.
            let base;
            if (options.arguments.length) {
                base = project.directory(options.arguments[0]);
            } else {
                let publicPath = project.directories.public;
                if (publicPath) {
                    base = publicPath;
                } else {
                    base = project;
                }
            }

            const LiveReloadServer = mix(Server).with(...[
                options.watch && require('../../lib/Servers/LiveReload'),
                require('../../lib/Servers/Static'),
                require('../../lib/Servers/Html5'),
                options.tunnel && require('../../lib/Servers/Tunnel'),
            ].filter(Boolean));

            // Load configuration.
            const config = {
                base: base.path,
                port: options.port,
                directory: options.directory === true,
                static: [
                    {
                        route: '/node_modules',
                        dir: 'node_modules',
                    },
                ],
                tunnel: options.tunnel,
                compress: options.compress,
            };

            if (options.https === true) {
                config.https = {
                    key: app.store.file('https/https.key').path,
                    cert: app.store.file('https/https.pem').path,
                };
            }

            const server = new LiveReloadServer(config);

            await server.listen();

            if (options.watch) {
                // Configure watch.
                base.watch({
                    ignore: [/\.git/, /\.map$/],
                }, (eventType, file) => {
                    // File updated: notify BrowserSync so that it can be reloaded.
                    server.reload(base.relative(file));
                    if (eventType !== 'unlink') {
                        app.logger.info(`${file.localPath} injected`);
                    } else {
                        app.logger.info(`${file.localPath} removed`);
                    }
                });
            }

            const { url, tunnel } = server.address;
            app.logger.success(`server started at ${url}${tunnel ? ` / ${tunnel}` : ''}`);

            process.on('exit', async () => {
                await server.close();
            });

            return server;
        });
};
