#! /usr/bin/env node --expose-gc

/* eslint-disable */

var version = process.version.replace(/^v/, '').split('.');
if (version[0] < 8 || (version[0] == 8 && version[1] < 9)) {
    console.log('\nRNA requires Node.js 8.9.0 or higher to be installed.\n');
    process.exit(1);
}

/* eslint-enable */

require('dotenv').config();

const CLI = require('./lib/cli.js');
const packageJson = require('./package.json');

const program = new CLI('rna-cli', packageJson.version);

require('./commands/help/index.js')(program);
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
        await program.start();
    } catch (err) {
        if (err) {
            // eslint-disable-next-line
            console.error(err);
        }
        process.exit(1);
    }
})();

process.on('SIGINT', async () => {
    process.exit();
});
