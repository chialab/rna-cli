const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const browserSync = require('browser-sync').create();
const chokidar = require('chokidar');
const md5File = require('md5-file');
const commondir = require('commondir');
const cwd = require('../../lib/paths.js').cwd;
const optionsUtils = require('../../lib/options.js');
const wait = require('../../lib/watch-queue.js');

module.exports = (app, options = {}) => new global.Promise((resolve, reject) => {
    let filter = optionsUtils.handleArguments(options);
    let base = filter.files.length ? commondir(filter.files) : './public';
    base = path.resolve(cwd, base);
    let config = {
        server: {
            baseDir: base,
            directory: !!options.directory,
        },
        // files: [],
        ghostMode: false,
        logLevel: 'silent',
        logFileChanges: false,
        open: false,
        xip: true,
        injectChanges: true,
        middleware: !options.directory && [
            (req, res, next) => {
                if (!req.xhr && req.headers && req.headers.accept &&
                    req.headers.accept.indexOf('text/html') !== -1) {
                    req.url = '/index.html';
                }
                return next();
            },
        ],
    };
    if (options.port) {
        config.port = options.port;
    }
    if (options.watch) {
        let hashes = {};
        let ready = false;
        chokidar.watch(options.arguments, {}).on('all', (event, p) => {
            const onchange = (event, p) => {
                if (event === 'unlink') {
                    delete hashes[p];
                } else if (fs.statSync(p).isFile()) {
                    let hash = md5File.sync(p);
                    if (ready && hashes[p] !== hash) {
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
                wait(p, 200).then(() => onchange(event, p)).catch(() => { });
            } else {
                onchange(event, p);
            }
        }).on('ready', () => {
            ready = true;
        });
    }

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