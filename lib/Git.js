const exec = require('./exec.js');
const execSync = require('child_process').execSync;

class Git {
    constructor(cwd) {
        this.cwd = cwd;
    }
    /**
     * Initialize Git repository.
     *
     * @returns {Promise}
     */
    async init() {
        return await exec('git', ['-C', this.cwd, 'init']);
    }

    /**
     * Get URL of Git remote named "origin".
     *
     * @returns {Promise<string>}
     */
    async getRemote() {
        try {
            return await exec('git', ['-C', this.cwd, 'config', '--get', 'remote.origin.url'], true);
        } catch (err) {
            return null;
        }
    }

    /**
     * Remove Git remote named "origin".
     *
     * @returns {Promise<string>}
     */
    async removeRemote() {
        try {
            return await exec('git', ['-C', this.cwd, 'remote', 'remove', 'origin'], true);
        } catch (err) {
            return false;
        }
    }

    /**
     * Add Git remote named "origin".
     *
     * @param {String} url URL for remote (both fetch and push).
     * @returns {Promise<string>}
     */
    async addRemote(url) {
        if (await this.getRemote()) {
            await this.removeRemote();
        }
        return await exec('git', ['-C', this.cwd, 'remote', 'add', 'origin', url], true);
    }

    /**
     * Get actual branch name.
     *
     * @returns {String}
     */
    getBranchName() {
        try {
            return execSync(`git -C ${this.cwd} rev-parse --abbrev-ref HEAD`).toString();
        } catch (err) {
            return null;
        }
    }

    /**
     * Get actual commit short code.
     *
     * @returns {String}
     */
    getShortCommitCode() {
        try {
            return execSync(`git -C ${this.cwd} rev-parse --short HEAD`).toString();
        } catch (err) {
            return null;
        }
    }

    /**
     * Get actual commit message.
     *
     * @returns {String}
     */
    getCommitMessage() {
        try {
            return execSync(`git -C ${this.cwd} log -1 --pretty=%B`).toString();
        } catch (err) {
            return null;
        }
    }
}

module.exports = Git;
