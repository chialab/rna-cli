const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const workbox = require('workbox-build');

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
    if (fs.existsSync(output)) {
        return workbox.injectManifest({
            swSrc: output,
            swDest: output,
            globDirectory: input,
            globPatterns: ['**/*'],
            globIgnores: ['service-worker.js'],
            maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
        }).then((res) => {
            task();
            app.log(`${colors.bold(colors.green('service worker updated!'))} ${colors.grey(`(${output})`)}`);
            remember(app, path.relative(input, output));
            return global.Promise.resolve(res);
        }).catch((err) => {
            task();
            app.log(colors.green('failed to update service worker'));
            return global.Promise.reject(err);
        });
    } else {
        return workbox.generateSW({
            globDirectory: input,
            swDest: output,
            globPatterns: ['**/*'],
            globIgnores: ['service-worker.js'],
            maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
        }).then((res) => {
            task();
            app.log(`${colors.bold(colors.green('service worker generated!'))} ${colors.grey(`(${output})`)}`);
            remember(app, path.relative(input, output));
            return global.Promise.resolve(res);
        }).catch((err) => {
            task();
            app.log(colors.green('failed to generate service worker'));
            return global.Promise.reject(err);
        });
    }
};
