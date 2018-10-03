const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const workbox = require('workbox-build');
const Watcher = require('../../lib/Watcher');
const fileSize = require('../../lib/file-size.js');
const store = require('../../lib/store.js');

/**
 * Command action to add files to precache for a service worker.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = async function sw(app, options) {
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

    if (fs.existsSync(`${options.output}.map`)) {
        fs.unlinkSync(`${options.output}.map`);
    }

    try {
        let res;
        if (fs.existsSync(output)) {
            let tmpFile = store.tmpfile('sw.js');
            tmpFile.write(fs.readFileSync(output, 'utf8').replace(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/gi, '.$1([])'));
            try {
                res = await workbox.injectManifest({
                    swSrc: tmpFile.path,
                    swDest: output,
                    globDirectory: input,
                    globPatterns: ['**/*'],
                    globIgnores: exclude,
                    maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                });
            } catch (err) {
                tmpFile.unlink();
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
            let watcher = new Watcher(input, {
                log: false,
                debounce: 200,
                ignore: '**/*.map',
            });

            watcher.watch((event, file) => {
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
