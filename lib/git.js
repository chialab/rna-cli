const exec = require('./exec.js');
const paths = require('./paths.js');
const execSync = require('child_process').execSync;

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
            .catch(() => global.Promise.resolve())
            .then(() =>
                exec(`git -C ${paths.cwd} remote add origin ${url}`, true)
            );
    },

    /**
     * Get actual branch name.
     *
     * @returns {String}
     * */
    getBranchName() {
        return execSync('git rev-parse --abbrev-ref HEAD');
    },

    /**
     * Get actual commit short code.
     *
     * @returns {String}
     * */
    getShortCommitCode() {
        return execSync('git rev-parse --short HEAD');
    },

    /**
     * Get actual commit message.
     *
     * @returns {String}
     * */
    getCommitMessage() {
        return execSync('git log -1 --pretty=%B');
    },
};
