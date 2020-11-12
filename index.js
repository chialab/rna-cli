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
        require('./commands/unit')(program);
        require('./commands/publish')(program);
        require('./commands/documentate')(program);
        require('./commands/config')(program);
        require('./commands/manifest')(program);
        require('./commands/sw')(program);
        require('./commands/start')(program);
        require('./commands/test')(program);
        require('./commands/add')(program);
        require('./commands/remove')(program);
        require('./commands/install')(program);
        require('./commands/run')(program);

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
