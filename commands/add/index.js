/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('add')
        .description('Add project dependencies.')
        .readme(`${__dirname}/README.md`)
        .option('<module1> <module2> <module3>', 'The modules to add.')
        .option('[--dev]', 'Add to dev dependencies.')
        .deprecate('2.0.0', 'Please use `yarn add`.')
        .action(async (app, options) => {
            const { Project } = require('../../lib/Navigator');

            const cwd = process.cwd();
            const project = new Project(cwd);

            // Add requested packages.
            if (options.dev) {
                return await project.packageManager.dev(...options.arguments);
            }

            await project.packageManager.add(...options.arguments);
            app.logger.success('packages successfully added');
        });
};
