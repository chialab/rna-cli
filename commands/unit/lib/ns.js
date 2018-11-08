const exec = require('../../../lib/exec.js');

module.exports = async function runNativeScriptTest(app, file, platform) {
    let dir = app.store.tmpdir('NSTest');
    let testDir = dir.directory('Test');
    await exec('tns', ['create', 'Test', '--path', dir.path]);
    await exec('tns', ['test', 'init', '--path', testDir.path, '--framework', 'mocha']);
    testDir.directory('tests').file('test.js').write(file.read());
    await exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', testDir.path]);
};
