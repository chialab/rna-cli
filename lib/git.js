const exec = require('./exec.js');
const paths = require('./paths.js');

module.exports = {
    init() {
        return exec(`git -C ${paths.cwd} init`);
    },
    
    getRemote() {
        return exec(`git -C ${paths.cwd} config --get remote.origin.url`, true);
    },

    addRemote(url) {
        return this.getRemote()
            .then((res) => (res ? exec(`git -C ${paths.cwd} remote remove origin`, true) : global.Promise.resolve()))
            .catch(() => global.Promise.resolve())
            .then(() =>
                exec(`git -C ${paths.cwd} remote add origin ${url}`, true)
            );
    },
};