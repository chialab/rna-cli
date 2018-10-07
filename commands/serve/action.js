const colors = require('colors/safe');
const commondir = require('commondir');
const { mix } = require('@chialab/proteins');
const Watcher = require('../../lib/Watcher');
const Project = require('../../lib/Project.js');
const Server = require('../../lib/Servers/Server.js');

/**
 * Command action to run a local development server.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function serve(app, options = {}) {
    const cwd = process.cwd();
    const project = new Project(cwd);

    // Load directory to be served.
    let entries;
    if (options.arguments.length) {
        entries = project.resolve(options.arguments);
    } else {
        let publicPath = project.directories.public;
        if (publicPath) {
            entries = [publicPath];
        } else {
            entries = [project];
        }
    }

    let base = commondir(
        entries.map((entry) => entry.path)
    );

    if (options.arguments.length > 1) {
        // serving multi path, force directory option
        options.directory = true;
    }

    let LiveReloadServer = mix(Server).with(...[
        options.watch && require('../../lib/Servers/LiveReload.js'),
        require('../../lib/Servers/Static.js'),
        require('../../lib/Servers/Html5.js'),
        options.tunnel && require('../../lib/Servers/Tunnel.js'),
    ].filter(Boolean));

    // Load configuration.
    let config = {
        base,
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
    if (options.https === true || options['https.key']) {
        config.https = {
            key: options['https.key'] || app.store.file('https/https.key').path,
            cert: options['https.cert'] || app.store.file('https/https.pem').path,
        };
    }

    let server = new LiveReloadServer(config);

    await server.listen();

    if (options.watch) {
        // Configure watch.
        let watcher = new Watcher(base, {
            log: false,
            ignore: '**/*.map',
        });

        watcher.watch((event, file) => {
            let toReload = file.replace(base, '').replace(/^\/*/, '');
            // File updated: notify BrowserSync so that it can be reloaded.
            server.reload(toReload);
            if (event !== 'unlink') {
                app.log(colors.cyan(`${toReload} injected.`));
            }
        });
    }

    let { url, tunnel } = server.address;
    app.log(colors.bold(`${colors.green('server started:')} ${colors.cyan(url)}${tunnel ? ` / ${colors.cyan(tunnel)}` : ''}`));

    process.on('exit', async () => {
        await server.close();
    });

    return server;
};
