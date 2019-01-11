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
        .description('Set RNA cli configiration.')
        .option('<key> <value>', 'The key/value pair to set.')
        .action(async (app, options) => {
            if (options.arguments.length !== 2) {
                throw 'you must provide a key/value pair to set';
            }

            let key = options.arguments[0];
            let value = options.arguments[1];
            try {
                value = JSON.parse(value);
            } catch {
                //
            }

            if (value === null) {
                app.store.remove(key);
            } else {
                app.store.set(key, value);
            }
        });
};
