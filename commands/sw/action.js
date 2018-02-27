const fs = require('fs');
const path = require('path');
const paths = require('paths');
const colors = require('colors/safe');
const workbox = require('workbox-build');
const Watcher = require('../../lib/Watcher');
const glob = require('glob');

function remember(app, output) {
    app.log(colors.yellow('remember to include'));
    app.log(colors.grey(`<script>
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('${output}', {scope: '/'})
            .then(function(reg) {
                // registration worked
            }).catch(function(error) {
                // registration failed
            });
    }
</script>`));
    app.log(colors.yellow('in your index.html file.'));
}

/**
 * Command action to add files to precache for a service worker.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise|void}
 */
module.exports = (app, options) => {
    if (!options.arguments.length) {
        app.log(colors.red('missin input files.'));
        return global.Promise.reject();
    }
    if (!options.output) {
        app.log(colors.red('missin output file.'));
        return global.Promise.reject();
    }
    const input = path.resolve(process.cwd(), options.arguments[0]);
    const output = path.resolve(process.cwd(), options.output);
    let task = app.log('generating service worker...', true);
    let returnPromise;
    let exclude = [
        'service-worker.js',
        '*.map',
    ];
    if (options.exclude) {
        exclude.push(options.exclude);
    }
    if (fs.existsSync(output)) {
        fs.writeFileSync(
            output,
            fs.readFileSync(output, 'utf8').replace(/\.precache\s*\(\s*\[([^\]]*)\]\)/gi, '.precache([])')
        );
        returnPromise = workbox.injectManifest({
            swSrc: output,
            swDest: output,
            globDirectory: input,
            globPatterns: ['**/*'],
            globIgnores: exclude,
            maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
        });
    } else {
        returnPromise = workbox.generateSW({
            globDirectory: input,
            swDest: output,
            globPatterns: ['**/*'],
            globIgnores: exclude,
            maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
        });
    }
    return returnPromise.then((res) => {
        task();
        app.log(`${colors.bold(colors.green('service worker generated!'))} ${colors.grey(`(${output})`)}`);
        if (options.remember !== false) {
            remember(app, path.relative(input, output));
        }
        if (options.watch) {
            const FILES = glob.sync(path.join(input, '**/*'), {
                ignore: exclude.map((pattern) => path.join(input, pattern)),
            });
            FILES.push(output);
            const WATCHER = new Watcher({
                log: false,
                debounce: 200,
                ignored: '**/*.map',
                cwd: paths.cwd,
            });
            WATCHER.add(FILES);
            return WATCHER.watch((event, file) => {
                if (file === output) {
                    return;
                }
                app.exec('sw', Object.assign({}, options, { remember: false, watch: false }));
            });
        }
        return global.Promise.resolve(res);
    }).catch((err) => {
        task();
        app.log(colors.red('failed to generate service worker'));
        return global.Promise.reject(err);
    });
};
