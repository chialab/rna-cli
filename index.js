#! /usr/bin/env node

const CLI = require('./cli.js');
const program = new CLI();

program.version('0.7.0');

require('./commands/help/index.js')(program);
require('./commands/setup/index.js')(program);
require('./commands/add/index.js')(program);
require('./commands/remove/index.js')(program);
require('./commands/bootstrap/index.js')(program);
require('./commands/lint/index.js')(program);
require('./commands/build/index.js')(program);
require('./commands/watch/index.js')(program);
require('./commands/serve/index.js')(program);
require('./commands/test/index.js')(program);
require('./commands/start/index.js')(program);
require('./commands/publish/index.js')(program);

program.start();