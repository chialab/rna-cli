const exec = require('../../../lib/exec.js');

module.exports = async function runNativeScriptTest(app, file, platform) {
    let dir = app.store.tmpdir('NSTest');
    let appDir = dir.directory('Test');
    await exec('tns', ['create', 'Test', '--path', dir.path, '--js']);
    await exec('tns', ['test', 'init', '--path', appDir.path, '--framework', 'mocha']);
    let testDir = appDir.directory('app').directory('tests');
    testDir.empty();
    testDir.file('test.js').write(file.read());
    await exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', appDir.path]);
};
