const manager = require('../../lib/package-manager.js');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

module.exports = (program) => {
    program
        .command('add')
        .description('Add project dependencies.')
        .help('A simple alias to `yarn add` command.')
        .option('module1 [module2] [module3]', 'The modules to add')
        .action((app, options = {}) => {
            if (!paths.cwd) {
                app.log('no project found.'.red);
                return global.Promise.reject();
            }
            let args = options.arguments || [];
            if (args.length === 0) {
                app.log(`${utils.extractRandom(['🤷‍', '🤷‍♂️'])} specify the package to add.`.yellow);
            } else {
                return manager.add(...options.arguments)
                    .then((res) => {
                        app.log('packages successfully added.'.green);
                        return global.Promise.resolve(res);
                    })
                    .catch((err) => {
                        app.log('failed to add packages.'.red);
                        return global.Promise.reject(err);
                    });
            }
        });
};