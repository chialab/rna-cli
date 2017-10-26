const timeouts = {};

module.exports = (file, time) => {
    if (timeouts[file]) {
        timeouts[file].reject();
        clearInterval(timeouts[file].timeout);
    }
    return new global.Promise((resolve, reject) => {
        timeouts[file] = {
            resolve,
            reject,
            timeout: setTimeout(() => {
                resolve();
                delete timeouts[file];
            }, time),
        };
    });
};