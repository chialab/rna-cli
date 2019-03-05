/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('sw')
        .description('Generate a service worker.')
        .readme(`${__dirname}/README.md`)
        .option('<path>', 'Root of the app to cache.')
        .option('--output', 'The service worker to generate or update.')
        .option('[--exclude]', 'A glob of files to exclude from the precache.')
        .option('[--watch]', 'Regenerated service worker on source changes.')
        .action(async function sw(app, options) {
            if (!options.arguments.length) {
                throw 'missing input files.';
            }

            const workbox = require('workbox-build');
            const Watcher = require('../../lib/Watcher');
            const Project = require('../../lib/Project');

            const cwd = process.cwd();
            const project = new Project(cwd);

            let input = project.directory(options.arguments[0]);

            let output;
            if (options.output) {
                output = project.file(options.output);
            } else {
                input.file('service-worker.js');
            }
            app.logger.play('generating service worker...');
            let exclude = [
                'service-worker.js',
                '*.map',
            ];
            if (options.exclude) {
                exclude.push(options.exclude);
            }

            if (output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            try {
                let res;
                if (output.exists()) {
                    let content = output.read();
                    if (content.match(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/i)) {
                        let tmpFile = app.store.tmpfile('sw.js');
                        tmpFile.write(content.replace(/\.(precache|precacheAndRoute)\s*\(\s*\[([^\]]*)\]\)/gi, '.$1([])'));
                        try {
                            res = await workbox.injectManifest({
                                swSrc: tmpFile.path,
                                swDest: output.path,
                                globDirectory: input.path,
                                globPatterns: ['**/*'],
                                globIgnores: exclude,
                                maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                            });
                        } catch (err) {
                            tmpFile.unlink();
                            throw err;
                        }
                    } else {
                        res = content;
                    }
                } else {
                    res = await workbox.generateSW({
                        globDirectory: input.path,
                        swDest: output.path,
                        globPatterns: ['**/*'],
                        globIgnores: exclude,
                        maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                    });
                }

                app.logger.stop();

                let { size, zipped } = output.size;
                app.logger.success('service worker generated');
                app.logger.info(output.localPath, `${size}, ${zipped} zipped`);

                if (options.watch) {
                    let watcher = new Watcher(input, {
                        ignore: '**/*.map',
                    });

                    await watcher.watch(async (file) => {
                        if (file.path === output.path) {
                            const content = output.read();
                            if (!content.match(/\.(precache|precacheAndRoute)\(\[\]\)/)) {
                                return;
                            }
                        }
                        await sw(app, Object.assign({}, options, { watch: false }));
                    });
                }
                return res;
            } catch(err) {
                app.logger.stop();
                throw err;
            }
        });
};
