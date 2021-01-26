/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('config')
        .readme(`${__dirname}/README.md`)
        .description('Set rna cli configuration.')
        .option('[key] [value]', 'The key/value pair to set.')
        .option('--delete', 'Remove the key.')
        .action(async (app, options) => {
            const config = app.store.toJSON();
            if (options.arguments.length === 0) {
                app.logger.log(JSON.stringify(config, null, 4));
                return;
            }

            const key = options.arguments[0];
            if (options.arguments.length === 1) {
                if (options.delete) {
                    app.store.remove(key);
                    app.logger.diff(config, app.store.toJSON());
                    return;
                }
                app.logger.log(JSON.stringify(app.store.get(key), null, 4));
                return;
            }

            let value = options.arguments[1];
            try {
                value = JSON.parse(value);
            } catch(error) {
                //
            }

            if (value === null) {
                app.store.remove(key);
            } else {
                app.store.set(key, value);
            }
            app.logger.diff(config, app.store.toJSON());
        });
};
