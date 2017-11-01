const timeouts = {};

/**
 * Return a promise that resolves after the given amount of time, relative to a file.
 *
 * @param {string} file File to be watched.
 * @param {integer} time Timeout for watch.
 * @return {Promise}
 */
module.exports = (file, time) => {
    if (timeouts[file]) {
        // Timeout was previously set. Reject previous promise and clear previously set timeout.
        timeouts[file].reject();
        clearInterval(timeouts[file].timeout);
    }
    let p = new global.Promise((resolve, reject) => {
        timeouts[file] = {
            resolve,
            reject,
            timeout: setTimeout(() => {
                // Resolve promise and push self-destruction button.
                resolve();
                delete timeouts[file];
            }, time),
        };
    });
    return p;
};
