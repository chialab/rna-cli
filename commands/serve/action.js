const path = require('path');
const colors = require('colors/safe');
const browserSync = require('browser-sync').create();
const watcher = require('../../lib/watcher.js');
const commondir = require('commondir');
const historyApiFallback = require('connect-history-api-fallback');
const cwd = require('../../lib/paths.js').cwd;
const optionsUtils = require('../../lib/options.js');

/**
 * Command action to run a local development server.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options = {}) => new global.Promise((resolve, reject) => {
    // Load directory to be served.
    let filter = optionsUtils.handleArguments(options);
    let base = filter.files.length ? commondir(filter.files) : './public';
    base = path.resolve(cwd, base);

    // Load configuration.
    let config = {
        server: {
            baseDir: base,
            directory: options.directory === true,
        },
        // files: [],
        ghostMode: false,
        logLevel: 'silent',
        logFileChanges: false,
        open: false,
        xip: true,
        injectChanges: true,
        middleware: !options.directory && [historyApiFallback({
            disableDotRule: true,
            htmlAcceptHeaders: ['text/html'],
        })],
        serveStatic: [
            {
                route: '/node_modules',
                dir: 'node_modules',
            },
            base,
        ],
    };
    if (options.https) {
        config.https = {
            key: options.https,
            cert: options.cert || path.join(path.dirname(options.https), 'cert.pem'),
        };
    }
    if (options.port) {
        // Use custom port.
        config.port = options.port;
    }

    // Start BrowserSync server.
    browserSync.init(config, (nil, server) => {
        if (nil) {
            return reject(nil);
        }
        let urlStr = server.options.get('urls').toJS().local;
        app.log(colors.cyan(`server ready at ${colors.magenta(urlStr)}`));
        resolve({
            config,
            bs: browserSync,
            server,
        });

        if (options.watch) {
            // Configure watch.
            watcher(app, base, (event, p) => {
                if (event !== 'unlink') {
                    let toReload = p.replace(base, '').replace(/^\/*/, '');
                    // File updated: notify BrowserSync so that it can be reloaded.
                    browserSync.reload(toReload);
                    app.log(colors.cyan(`${toReload} injected.`));
                }
                return global.Promise.resolve();
            }, {
                debounce: 200,
                log: false,
            });
        }
    });
});
