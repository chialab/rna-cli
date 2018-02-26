const fs = require('fs-extra');
const path = require('path');
const exec = require('../../../lib/exec.js');
const paths = require('../../../lib/paths.js');

module.exports = function runNativeScriptTest(platform, file) {
    let p = path.join(paths.tmp, 'NSTest');
    return exec('tns', ['create', 'Test', '--path', p])
        .then(() => exec('tns', ['test', 'init', '--path', `${p}/Test`, '--framework', 'mocha']))
        .then(() => fs.copy(file, `${p}/Test/app/tests`))
        .then(() => exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', `${p}/Test`]));

};
