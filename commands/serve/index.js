const path = require('path');
const browserSync = require('browser-sync');
const cwd = require('../../lib/paths.js').cwd;

module.exports = (program) => {
    program
        .command('serve')
        .description('Setup a server for your project.')
        .option('[file]', 'The server base directory.')
        .option('--public', 'The server base directory.')
        .option('--port', 'The server port.')
        .action((app, options = {}) =>
            new global.Promise((resolve, reject) => {
                let base = options.public || options.arguments[0] || './public';
                base = path.join(cwd, base);
                let config = {
                    server: {
                        baseDir: base,
                    },
                    files: [
                        path.join(base, '**/*'),
                    ],
                    ghostMode: false,
                    logLevel: 'silent',
                    logFileChanges: false,
                    open: false,
                    xip: true,
                    injectChanges: true,
                };
                if (options.port) {
                    config.port = options.port;
                }
                browserSync.init(config, (nil, server) => {
                    if (nil) {
                        return reject(nil);
                    }
                    let urlStr = server.options.get('urls').toJS().local.magenta;
                    app.log(`🚀  Server ready at ${urlStr}`.cyan);
                    resolve();
                });
            })
        );
};