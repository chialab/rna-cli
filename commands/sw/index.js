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
        .deprecate('3.0.0', 'Please checkout the new `rna build` features.')
        .action(async (app, options) => {
            if (!options.arguments.length) {
                throw new Error('missing input files');
            }

            const ServiceWorkerBundler = require('../../lib/Bundlers/ServiceWorkerBundler');
            const Watcher = require('../../lib/Watcher');
            const { Project } = require('../../lib/Navigator');

            const cwd = process.cwd();
            const project = new Project(cwd);

            let root = project.directory(options.arguments[0]);
            let output = options.output && project.file(options.output);
            let bundler = new ServiceWorkerBundler(app, project);

            await bundler.setup({
                root,
                output,
                exclude: options.exclude,
            });

            let res = await bundler.build();
            await bundler.write();

            if (options.watch) {
                let watcher = new Watcher(root, {
                    ignore: '**/*.map',
                });

                await watcher.watch(async (file) => {
                    if (file.path === output.path) {
                        const content = output.read();
                        if (!content.match(/\.(precache|precacheAndRoute)\(\[\]\)/)) {
                            return;
                        }
                    }
                    await bundler.build();
                    await bundler.write();
                });
            }

            return res;
        });
};
