const fs = require('fs');
const path = require('path');
const url = require('url');
const colors = require('colors/safe');
const commondir = require('commondir');
const store = require('../../lib/store.js');
const Watcher = require('../../lib/Watcher');
const cwd = require('../../lib/paths.js').cwd;
const Entry = require('../../lib/entry.js');

// Do not reload on change
const IGNORE = ['.map'];

/**
 * Command action to run a local development server.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options = {}) => new Promise((resolve, reject) => {
    // Load directory to be served.
    let entries = Entry.resolve(cwd, options.arguments);
    let files = entries.map((entry) => (entry.file ? entry.file.path : entry.package.path));
    let base = files.length ? commondir(files) : './public';
    base = path.resolve(cwd, base);
    if (options.arguments.length > 1) {
        // serving multi path, force directory option
        options.directory = true;
    }

    // Load configuration.
    let config = {
        server: {
            baseDir: base,
            directory: options.directory === true,
        },
        ghostMode: false,
        tunnel: options.tunnel,
        logFileChanges: false,
        open: false,
        notify: !!options.watch,
        injectChanges: !!options.watch,
        middleware: !options.directory && [
            (req, res, next) => {
                const headers = req.headers;
                if (req.method === 'GET' && headers.accept && headers.accept.includes('text/html') && !headers.origin) {
                    let parsed = url.parse(req.url);
                    let file = path.join(base, parsed.pathname);
                    if (!path.extname(file)) {
                        file += '.html';
                        req.url = `${parsed.pathname}.html`;
                    }
                    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
                        req.url = '/index.html';
                    }
                }
                return next();
            },
        ],
        serveStatic: [
            {
                route: '/node_modules',
                dir: 'node_modules',
            },
            base,
        ],
    };
    if (!options.watch) {
        // Disable BrowserSync sockets and tunnels.
        require('browser-sync/dist/async.js').startSockets = (bs, done) => { done(); };
        config.ui = false;
        config.snippetOptions = {
            rule: {
                match: /\${50}/i,
            },
        };
    }
    if (options.https === true || options['https.key']) {
        config.https = {
            key: options['https.key'] || store.file('https/https.key').path,
            cert: options['https.cert'] || store.file('https/https.pem').path,
        };
    }
    if (options.port) {
        // Use custom port.
        config.port = options.port;
    }

    const browserSync = require('browser-sync').create();

    // Start BrowserSync server.
    browserSync.init(config, (nil, server) => {
        if (nil) {
            return reject(nil);
        }

        if (options.watch) {
            // Watch only requested paths, not the commondir
            const PATHS = files
                .filter((p) => fs.statSync(p).isDirectory())
                .map((p) => path.join(p, '**/*'));
            // Configure watch.
            const WATCHER = new Watcher({
                cwd,
                debounce: 200,
                log: false,
            });
            WATCHER.add(PATHS);
            WATCHER.watch((event, p) => {
                if (event !== 'unlink' && !IGNORE.includes(path.extname(p))) {
                    let toReload = p.replace(base, '').replace(/^\/*/, '');
                    // File updated: notify BrowserSync so that it can be reloaded.
                    browserSync.reload(toReload);
                    app.log(colors.cyan(`${toReload} injected.`));
                }
            });
        }

        resolve({
            config,
            bs: browserSync,
            server,
        });
    });
});
