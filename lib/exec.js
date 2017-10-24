const exec = require('child_process').spawn;

module.exports = function execAsync(cmd) {
    return new global.Promise((resolve, reject) => {
        let splitted = cmd.split(' ');
        let p = exec(splitted.shift(), splitted, { stdio: 'inherit' });

        p.on('close', (code) => {
            if (code) {
                reject();
            } else {
                resolve();
            }
        });
    });
}