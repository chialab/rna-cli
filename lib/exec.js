const exec = require('child_process').spawn;

module.exports = function execAsync(cmd, result = false) {
    return new global.Promise((resolve, reject) => {
        let splitted = cmd.split(' ');
        let opts = {};
        if (!result) {
            opts.stdio = 'inherit';
        }
        let p = exec(splitted.shift(), splitted, opts);

        if (result) {
            p.stdout.setEncoding('utf8');
            p.stderr.setEncoding('utf8');
            p.stdout.on('data', (data) => resolve(data && data.trim()));
            p.stderr.on('data', (data) => reject(data.trim()));
            p.on('close', (code) => {
                if (code) {
                    reject();
                } else {
                    resolve(null);
                }
            });
        } else {
            p.on('close', (code) => {
                if (code) {
                    reject();
                } else {
                    resolve();
                }
            });
        }
    });
}