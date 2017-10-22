const fs = require('fs');
const path = require('path');
const browserSync = require('browser-sync').create();
const cwd = require('../../lib/paths.js').cwd;
const chokidar = require('chokidar');
const md5File = require('md5-file');

module.exports = (program) => {
    program
        .command('serve')
        .description('Setup a server for your project.')
        .option('[file]', 'The server base directory.')
        .option('--public', 'The server base directory.')
        .option('--port', 'The server port.')
        .option('--watch', 'Should watch directory')
        .action((app, options = {}) =>
            new global.Promise((resolve, reject) => {
                let base = options.public || options.arguments[0] || './public';
                base = path.join(cwd, base);
                let config = {
                    server: {
                        baseDir: base,
                    },
                    files: [],
                    ghostMode: false,
                    logLevel: 'silent',
                    logFileChanges: false,
                    open: false,
                    xip: true,
                    injectChanges: true,
                    middleware: [
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

                let hashes = {};
                let ready = false;
                chokidar.watch(base, {}).on('all', (event, p) => {
                    if (event === 'unlink') {
                        delete hashes[p];
                    } else if (fs.statSync(p).isFile()) {
                        let hash = md5File.sync(p);
                        if (ready && hashes[p] !== hash) {
                            browserSync.reload(
                                p.replace(base, '')
                            );
                            setTimeout(() => {
                                app.log(`${p.replace(base, '')} injected.`.cyan);
                            }, 100);
                        }
                        hashes[p] = hash;
                    }
                }).on('ready', () => {
                    ready = true;
                });

                browserSync.init(config, (nil, server) => {
                    if (nil) {
                        return reject(nil);
                    }
                    let urlStr = server.options.get('urls').toJS().local.magenta;
                    app.log(`server ready at ${urlStr}`.cyan);
                    resolve({
                        config,
                        bs: browserSync,
                        server,
                    });
                });
            })
        );
};