const fs = require('fs');
const path = require('path');
const paths = require('../../lib/paths.js');
const colors = require('colors/safe');
const workbox = require('workbox-build');
const Watcher = require('../../lib/Watcher');
const fileSize = require('../../lib/file-size.js');
const glob = require('glob');

/**
 * Command action to add files to precache for a service worker.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = async(app, options) => {
    if (!options.arguments.length) {
        throw 'Missin input files.';
    }
    if (!options.output) {
        throw 'Missin output file.';
    }
    let input = path.resolve(process.cwd(), options.arguments[0]);
    let output = path.resolve(process.cwd(), options.output);
    let task = app.log('generating service worker...', true);
    let exclude = [
        'service-worker.js',
        '*.map',
    ];
    if (options.exclude) {
        exclude.push(options.exclude);
    }

    try {
        let res;
        if (fs.existsSync(output)) {
            let tmpFile = `${output}.tmp`;
            fs.writeFileSync(
                tmpFile,
                fs.readFileSync(output, 'utf8').replace(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/gi, '.$1([])')
            );
            try {
                res = await workbox.injectManifest({
                    swSrc: tmpFile,
                    swDest: output,
                    globDirectory: input,
                    globPatterns: ['**/*'],
                    globIgnores: exclude,
                    maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                });
            } catch (err) {
                fs.unlinkSync(tmpFile);
                throw err;
            }
        } else {
            res = await workbox.generateSW({
                globDirectory: input,
                swDest: output,
                globPatterns: ['**/*'],
                globIgnores: exclude,
                maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
            });
        }

        task();
        app.log(colors.bold(colors.green('service worker generated!')));
        app.log(fileSize(options.output));
        if (options.watch) {
            let FILES = glob.sync(path.join(input, '**/*'), {
                ignore: exclude.map((pattern) => path.join(input, pattern)),
            });
            let WATCHER = new Watcher({
                log: false,
                debounce: 200,
                ignored: '**/*.map',
                cwd: paths.cwd,
            });
            WATCHER.add(FILES);
            await WATCHER.watch((event, file) => {
                if (file === output) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.indexOf('.precache([])') === -1) {
                        return;
                    }
                }
                app.exec('sw', Object.assign({}, options, { watch: false }));
            });
        }
        return res;
    } catch(err) {
        task();
        throw err;
    }
};
