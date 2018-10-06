const fs = require('fs-extra');
const exec = require('../../../lib/exec.js');

module.exports = async function runNativeScriptTest(app, platform, file) {
    let dir = app.store.tmpdir('NSTest');
    let testDir = dir.directory('Test');
    await exec('tns', ['create', 'Test', '--path', dir.path]);
    await exec('tns', ['test', 'init', '--path', testDir.path, '--framework', 'mocha']);
    await fs.copy(file, testDir.directory('tests').path);
    await exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', testDir.path]);
};
