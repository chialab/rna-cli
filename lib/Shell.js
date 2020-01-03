const { spawn, execSync } = require('child_process');

/**
 * Execute command, and return result on request.
 *
 * @param {string} cmd Command string to be executed.
 * @param {boolean} result
 * @return {Promise<string>}
 */
module.exports.exec = async function(bin, args, result = false) {
    return await new Promise((resolve, reject) => {
        const opts = {};
        if (!result) {
            opts.stdio = 'inherit';
        }
        const p = spawn(bin, args, opts);

        if (result) {
            // Standard output (1) and standard error (2) data requested.
            p.stdout.setEncoding('utf8');
            p.stderr.setEncoding('utf8');
            // Some commands might fail (exit code != 0) and still write data to /dev/stdout. ~~fquffio
            p.stdout.on('data', (data) => resolve(data && data.trim()));
            // Some commands might succeed (exit code == 0) and still write data to /dev/stderr. ~~fquffio
            p.stderr.on('data', (data) => reject(data.trim()));
            p.on('close', (code) => {
                if (code) {
                    reject();
                } else {
                    resolve(null);
                }
            });
        } else {
            // Just resolve or reject based on exit code.
            p.on('close', (code) => {
                if (code) {
                    reject();
                } else {
                    resolve();
                }
            });
        }
    });
};

module.exports.execSync = execSync;
