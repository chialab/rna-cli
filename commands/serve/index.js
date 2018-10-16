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
        .option('[--tunnel]', 'Create a tunnel for the server')
        .option('[--directory]', 'Should list directories.')
        .option('[--https]', 'Start a server using SSL.')
        .action(async (app, options = {}) => {
            const { mix } = require('@chialab/proteins');
            const Watcher = require('../../lib/Watcher');
            const Project = require('../../lib/Project.js');
            const Server = require('../../lib/Servers/Server.js');

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

            let LiveReloadServer = mix(Server).with(...[
                options.watch && require('../../lib/Servers/LiveReload.js'),
                require('../../lib/Servers/Static.js'),
                require('../../lib/Servers/Html5.js'),
                options.tunnel && require('../../lib/Servers/Tunnel.js'),
            ].filter(Boolean));

            // Load configuration.
            let config = {
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
            };

            if (options.https === true) {
                config.https = {
                    key: app.store.file('https/https.key').path,
                    cert: app.store.file('https/https.pem').path,
                };
            }

            let server = new LiveReloadServer(config);

            await server.listen();

            if (options.watch) {
                // Configure watch.
                let watcher = new Watcher(base, {
                    ignore: '**/*.map',
                });

                await watcher.watch((event, file) => {
                    // File updated: notify BrowserSync so that it can be reloaded.
                    server.reload(base.relative(file));
                    if (event !== 'unlink') {
                        app.logger.info(`${file.localPath} injected`);
                    }
                });
            }

            let { url, tunnel } = server.address;
            app.logger.success(`server started at ${url}${tunnel ? ` / ${tunnel}` : ''}`);

            process.on('exit', async () => {
                await server.close();
            });

            return server;
        });
};
