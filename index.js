#! /usr/bin/env node

/* eslint-disable */

var version = process.version.replace(/^v/, '').split('.');
if (version[0] < 8 || (version[0] == 8 && version[1] < 9)) {
    console.log('\nRNA requires Node.js 8.9.0 or higher to be installed.\n');
    process.exit(1);
}

/* eslint-enable */

require('dotenv').config();

const CLI = require('./lib/cli.js');

const program = new CLI('@chialab/rna-cli').version(require('./package.json').version);

require('./commands/help/index.js')(program);
require('./commands/start/index.js')(program);
require('./commands/test/index.js')(program);
require('./commands/add/index.js')(program);
require('./commands/remove/index.js')(program);
require('./commands/install/index.js')(program);
require('./commands/setup/index.js')(program);
require('./commands/lint/index.js')(program);
require('./commands/build/index.js')(program);
require('./commands/manifest/index.js')(program);
require('./commands/sw/index.js')(program);
require('./commands/serve/index.js')(program);
require('./commands/unit/index.js')(program);
require('./commands/publish/index.js')(program);
require('./commands/documentation/index.js')(program);
require('./commands/run/index.js')(program);
require('./commands/upgrade/index.js')(program);

(async() => {
    try {
        await program.start();
    } catch (err) {
        // eslint-disable-next-line
        console.error(err);
        process.exit(1);
    }
})();
