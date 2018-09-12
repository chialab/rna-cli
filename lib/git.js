const exec = require('./exec.js');
const execSync = require('child_process').execSync;

module.exports = {
    /**
     * Initialize Git repository.
     *
     * @param {String} path The git project path.
     * @returns {Promise}
     */
    async init(path) {
        return await exec('git', ['-C', path, 'init']);
    },

    /**
     * Get URL of Git remote named "origin".
     *
     * @param {String} path The git project path.
     * @returns {Promise<string>}
     */
    async getRemote(path) {
        try {
            return await exec('git', ['-C', path, 'config', '--get', 'remote.origin.url'], true);
        } catch (err) {
            return null;
        }
    },

    /**
     * Remove Git remote named "origin".
     *
     * @param {String} path The git project path.
     * @returns {Promise<string>}
     */
    async removeRemote(path) {
        try {
            return await exec('git', ['-C', path, 'remote', 'remove', 'origin'], true);
        } catch (err) {
            return false;
        }
    },

    /**
     * Add Git remote named "origin".
     *
     * @param {String} path The git project path.
     * @param {String} url URL for remote (both fetch and push).
     * @returns {Promise<string>}
     */
    async addRemote(path, url) {
        if (await this.getRemote()) {
            await this.removeRemote(path);
        }
        return await exec('git', ['-C', path, 'remote', 'add', 'origin', url], true);
    },

    /**
     * Get actual branch name.
     *
     * @param {String} path The git project path.
     * @returns {String}
     */
    getBranchName(path) {
        try {
            return execSync(`git -C ${path} rev-parse --abbrev-ref HEAD`).toString();
        } catch (err) {
            return null;
        }
    },

    /**
     * Get actual commit short code.
     *
     * @param {String} path The git project path.
     * @returns {String}
     */
    getShortCommitCode(path) {
        try {
            return execSync(`git -C ${path} rev-parse --short HEAD`).toString();
        } catch (err) {
            return null;
        }
    },

    /**
     * Get actual commit message.
     *
     * @param {String} path The git project path.
     * @returns {String}
     */
    getCommitMessage(path) {
        try {
            return execSync(`git -C ${path} log -1 --pretty=%B`).toString();
        } catch (err) {
            return null;
        }
    },
};
