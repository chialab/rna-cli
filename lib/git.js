const exec = require('./exec.js');
const paths = require('./paths.js');

module.exports = {
    /**
     * Initialize Git repository.
     *
     * @returns {Promise}
     */
    init() {
        return exec(`git -C ${paths.cwd} init`);
    },

    /**
     * Get URL of Git remote named "origin".
     *
     * @returns {Promise<string>}
     */
    getRemote() {
        return exec(`git -C ${paths.cwd} config --get remote.origin.url`, true);
    },

    /**
     * Remove Git remote named "origin".
     *
     * @returns {Promise<string>}
     */
    removeRemote() {
        return exec(`git -C ${paths.cwd} remote remove origin`, true)
            .catch(() => global.Promise.resolve());
    },

    /**
     * Add Git remote named "origin".
     *
     * @param {string} url URL for remote (both fetch and push).
     * @returns {Promise<string>}
     */
    addRemote(url) {
        return this.getRemote()
            .then(() => this.removeRemote())
            .then(() =>
                exec(`git -C ${paths.cwd} remote add origin ${url}`, true)
            );
    },
};
