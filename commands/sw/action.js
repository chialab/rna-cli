const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const workbox = require('workbox-build');
const Watcher = require('../../lib/Watcher');
const store = require('../../lib/store.js');
const utils = require('../../lib/utils.js');

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
        let { size, zipped } = utils.size(options.output);
        app.log(`${utils.relativeToCwd(options.output)} ${colors.grey(`(${utils.prettyBytes(size)}, ${utils.prettyBytes(zipped)} zipped)`)}`);
        if (options.watch) {
            let watcher = new Watcher(input, {
                log: false,
                ignore: '**/*.map',
            });

            watcher.watch(async (event, file) => {
                if (file === output) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (!content.match(/\.(precache|precacheAndRoute)\(\[\]\)/)) {
                        return;
                    }
                }
                await sw(app, Object.assign({}, options, { watch: false }));
            });
        }
        return res;
    } catch(err) {
        task();
        throw err;
    }
};
