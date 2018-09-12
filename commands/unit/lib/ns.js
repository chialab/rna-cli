const fs = require('fs-extra');
const path = require('path');
const exec = require('../../../lib/exec.js');
const paths = require('../../../lib/paths.js');

module.exports = async function runNativeScriptTest(platform, file) {
    let p = path.join(paths.tmp, 'NSTest');
    await exec('tns', ['create', 'Test', '--path', p]);
    await exec('tns', ['test', 'init', '--path', `${p}/Test`, '--framework', 'mocha']);
    await fs.copy(file, `${p}/Test/app/tests`);
    await exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', `${p}/Test`]);
};
