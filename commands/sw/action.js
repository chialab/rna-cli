const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const workbox = require('workbox-build');
const watcher = require('../../lib/watcher.js');

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
    if (fs.existsSync(output)) {
        fs.writeFileSync(
            output,
            fs.readFileSync(output, 'utf8').replace(/\.precache\s*\(\s*\[([^\]]*)\]\)/gi, '.precache([])')
        );
        let exclude = [
            'service-worker.js',
            '*.map',
        ];
        if (options.exclude) {
            exclude.push(options.exclude);
        }
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
            globIgnores: ['service-worker.js', '*.map'],
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
            let lastContent = fs.readFileSync(output, 'utf8');
            watcher(app, path.join(input, '**/*'), (event, file) => {
                if (file === output) {
                    if (fs.readFileSync(output, 'utf8') === lastContent) {
                        return;
                    }
                }
                app.exec('sw', Object.assign({}, options, { remember: false, watch: false }))
                    .then(() => {
                        lastContent = fs.readFileSync(output, 'utf8');
                    });
            }, {
                log: false,
                debounce: 200,
                ignored: '**/*.map',
            });
        }
        return global.Promise.resolve(res);
    }).catch((err) => {
        task();
        app.log(colors.red('failed to generate service worker'));
        return global.Promise.reject(err);
    });
};
