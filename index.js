#! /usr/bin/env node

require('dotenv').config();

const CLI = require('./lib/Cli/Cli');
const packageJson = require('./package.json');

const program = new CLI('rna', packageJson.name, packageJson.version);

require('./commands/config/index.js')(program);
require('./commands/start/index.js')(program);
require('./commands/test/index.js')(program);
require('./commands/add/index.js')(program);
require('./commands/remove/index.js')(program);
require('./commands/install/index.js')(program);
require('./commands/init/index.js')(program);
require('./commands/lint/index.js')(program);
require('./commands/build/index.js')(program);
require('./commands/manifest/index.js')(program);
require('./commands/sw/index.js')(program);
require('./commands/serve/index.js')(program);
require('./commands/unit/index.js')(program);
require('./commands/publish/index.js')(program);
require('./commands/documentation/index.js')(program);
require('./commands/run/index.js')(program);

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

process.on('SIGINT', async () => {
    process.exit(1);
});
