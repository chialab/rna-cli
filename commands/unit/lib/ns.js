const fs = require('fs-extra');
const exec = require('../../../lib/exec.js');
const store = require('../../../lib/store.js');

module.exports = async function runNativeScriptTest(platform, file) {
    let dir = store.tmpdir('NSTest');
    let testDir = dir.directory('Test');
    await exec('tns', ['create', 'Test', '--path', dir.path]);
    await exec('tns', ['test', 'init', '--path', testDir.path, '--framework', 'mocha']);
    await fs.copy(file, testDir.directory('tests').path);
    await exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', testDir.path]);
};
