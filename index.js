#! /usr/bin/env node

require('dotenv').config();

const CLI = require('./lib/Cli/Cli');
const packageJson = require('./package.json');

CLI.init('rna', packageJson.name, packageJson.version)
    .then((program) => {
        require('./commands/init')(program);
        require('./commands/build')(program);
        require('./commands/serve')(program);
        require('./commands/lint')(program);
        require('./commands/test')(program);
        require('./commands/publish')(program);
        require('./commands/documentate')(program);
        require('./commands/config')(program);

        (async () => {
            try {
                await program.start(process.argv.slice(2));
            } catch (err) {
                if (err) {
                    // eslint-disable-next-line
                    console.error(err);
                }
                process.exit(1);
            }
        })();
    });

process.on('SIGINT', async () => {
    process.exit(1);
});
