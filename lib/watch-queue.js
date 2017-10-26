const timeouts = {};

module.exports = (file, time) => {
    if (timeouts[file]) {
        timeouts[file].reject();
        clearInterval(timeouts[file].timeout);
    }
    let p = new global.Promise((resolve, reject) => {
        timeouts[file] = {
            resolve,
            reject,
            timeout: setTimeout(() => {
                resolve();
                delete timeouts[file];
            }, time),
        };
    });
    return p;
};