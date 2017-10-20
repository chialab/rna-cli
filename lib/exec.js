const exec = require('child_process').exec;

module.exports = function execAsync(cmd) {
    return new global.Promise((resolve, reject) => {
        exec(cmd, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}