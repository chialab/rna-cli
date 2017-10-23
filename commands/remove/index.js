const manager = require('../../lib/package-manager.js');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');

module.exports = (program) => {
    program
        .command('remove')
        .description('Remove project dependencies.')
        .help('A simple alias to `yarn add` command.')
        .option('module1 [module2] [module3]', 'The modules to remove')
        .action((app, options = {}) => {
            if (!paths.cwd) {
                app.log('no project found.'.red);
                return global.Promise.reject();
            }
            let args = options.arguments || [];
            if (args.length === 0) {
                app.log(`${utils.extractRandom(['🤷‍', '🤷‍♂️'])} specify the package to remove.`.yellow);
            } else {
                return manager.remove(...options.arguments)
                    .then((res) => {
                        app.log('packages successfully removed.'.green);
                        return global.Promise.resolve(res);
                    })
                    .catch((err) => {
                        app.log('failed to remove packages.'.red);
                        return global.Promise.reject(err);
                    });
            }
        });
};