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
        .option('[--watch]', 'Should watch server directory.')
        .option('[--port]', 'The server port.')
        .option('[--tunnel]', 'Create a tunnel for the server.')
        .option('[--directory]', 'Should list directories.')
        .option('[--https]', 'Start a server using SSL.')
        .option('[--compress]', 'Activate gzip compression on static files.')
        .action(async (app, options = {}) => {
            const { mix } = require('@chialab/proteins');
            const { Project } = require('../../lib/File');
            const { Base, Static, HTML5, Tunnel, LiveReload } = require('../../lib/Servers');

            const cwd = process.cwd();
            const project = new Project(cwd);

            // Load directory to be served.
            let directory;
            if (options.arguments.length) {
                directory = project.directory(options.arguments[0]);
            } else {
                let publicPath = project.directories.public;
                if (publicPath) {
                    directory = publicPath;
                } else {
                    directory = project;
                }
            }

            const mixins = [
                options.watch && LiveReload,
                Static,
                HTML5,
                options.tunnel && Tunnel,
            ].filter(Boolean);
            const Server = mix(Base).with(...mixins);

            const server = new Server({
                base: directory.path,
                port: options.port,
                directory: options.directory === true,
                static: [
                    {
                        route: '/node_modules',
                        dir: 'node_modules',
                    },
                ],
                https: options.https ? {
                    key: app.store.file('https/https.key').path,
                    cert: app.store.file('https/https.pem').path,
                } : false,
                tunnel: options.tunnel,
                compress: options.compress,
            });

            await server.listen();

            if (options.watch) {
                // Configure watch.
                directory.watch({
                    ignore: [/\.git/, /\.map$/],
                }, (eventType, file) => {
                    // File updated: notify BrowserSync so that it can be reloaded.
                    server.reload(directory.relative(file));
                    if (eventType === 'unlink') {
                        app.logger.info(`${file.path} removed`);
                    } else {
                        app.logger.info(`${project.relative(file)} injected`);
                    }
                });
            }

            const { url, tunnel } = server.address;
            app.logger.success(`server started at ${url}${tunnel ? ` / ${tunnel}` : ''}`);
            app.logger.newline();

            process.on('exit', async () => {
                await server.close();
            });

            return server;
        });
};
