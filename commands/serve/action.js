const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const browserSync = require('browser-sync').create();
const chokidar = require('chokidar');
const md5File = require('md5-file');
const commondir = require('commondir');
const historyApiFallback = require('connect-history-api-fallback');
const cwd = require('../../lib/paths.js').cwd;
const optionsUtils = require('../../lib/options.js');
const wait = require('../../lib/watch-queue.js');

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
        middleware: !options.directory && [historyApiFallback()],
    };
    if (options.port) {
        // Use custom port.
        config.port = options.port;
    }
    if (options.watch) {
        // Configure watch.
        let hashes = {};
        let ready = false;
        chokidar.watch(options.watch !== true ? options.watch : options.arguments, {}).on('all', (event, p) => {
            /**
             * On change callback.
             * @param {string} event Filesystem event type.
             * @param {string} p Path.
             * @returns {void}
             */
            const onchange = (event, p) => {
                if (event === 'unlink') {
                    // Deleted file: stop watching it.
                    delete hashes[p];
                } else if (fs.statSync(p).isFile()) {
                    let hash = md5File.sync(p);
                    if (ready && hashes[p] !== hash) {
                        // File updated: notify BrowserSync so that it can be reloaded.
                        browserSync.reload(
                            p.replace(base, '')
                        );
                        setTimeout(() => {
                            app.log(colors.cyan(`${p.replace(base, '')} injected.`));
                        }, 100);
                    }
                    hashes[p] = hash;
                }
            };
            if (ready) {
                // Not yet ready: delay onchange event by a little bit.
                wait(p, 200).then(() => onchange(event, p)).catch(() => { });
            } else {
                onchange(event, p);
            }
        }).on('ready', () => {
            ready = true;
        });
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
    });
});
