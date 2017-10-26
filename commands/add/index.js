module.exports = (program) => {
    program
        .command('add')
        .description('Add project dependencies.')
        .help('A simple alias to `yarn add` command.')
        .option('module1 [module2] [module3]', 'The modules to add')
        .action((app, options = {}) => require('./action')(app, options));
};