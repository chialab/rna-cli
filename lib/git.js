const exec = require('./exec.js');
const paths = require('./paths.js');

module.exports = {
    init() {
        return exec(`git -C ${paths.cwd} init`);
    },
    
    getRemote() {
        return exec(`git -C ${paths.cwd} config --get remote.origin.url`, true);
    },

    removeRemote() {
        return exec(`git -C ${paths.cwd} remote remove origin`, true)
            .catch(() => global.Promise.resolve());
    },

    addRemote(url) {
        return this.getRemote()
            .then(() => this.removeRemote())
            .then(() =>
                exec(`git -C ${paths.cwd} remote add origin ${url}`, true)
            );
    },
};