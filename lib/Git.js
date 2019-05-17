const { existsSync } = require('fs');
const { join } = require('path');
const exec = require('./exec');
const execSync = require('child_process').execSync;

/**
 * @class Git
 * A git helper for a project.
 * It uses child process for git commands.
 * It needs Git to be installed.
 */
class Git {
    /**
     * Create a git helper instance.
     * @param {string} cwd The git directory.
     * @return {Git}
     */
    constructor(cwd) {
        this.cwd = cwd;
    }

    /**
     * Check if a project is a Git project.
     * @return {boolean}
     */
    check() {
        return existsSync(join(this.cwd, '.git'));
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
     * @param {string} url URL for remote (both fetch and push).
     * @returns {Promise<string>}
     */
    async addRemote(url) {
        if (await this.getRemote()) {
            await this.removeRemote();
        }
        return await exec('git', ['-C', this.cwd, 'remote', 'add', 'origin', url], true);
    }

    /**
     * Stage files.
     *
     * @param {string} pattern The files pattern.
     * @return {Promise}
     */
    async add(pattern) {
        return execSync(`git -C ${this.cwd} add ${pattern || '.'}`);
    }

    /**
     * Perform a commit.
     *
     * @param {string} message The commit message.
     * @return {Promise}
     */
    async commit(message) {
        let args = message ? ['-m', `"${message}"`] : [];
        return execSync(`git -C ${this.cwd} commit ${args.join(' ')}`);
    }

    /**
     * Add a tag.
     *
     * @param {string} tag The tag to add.
     * @param {string} message The message to add.
     * @return {Promise}
     */
    async tag(tag, message = tag) {
        return execSync(`git -C ${this.cwd} tag -a "${tag}" -m ${message}`);
    }

    /**
     * Push the repository.
     *
     * @param {string} origin The remote target.
     * @param {boolean} tags Should push tags.
     * @return {Promise}
     */
    async push(origin, tags) {
        let args = origin ? [origin] : [];
        if (tags) {
            args.push('--tag');
        }
        return execSync(`git -C ${this.cwd} push ${args.join(' ')}`);
    }

    /**
     * Create a release commit with tag.
     *
     * @param {string} version The version to release.
     * @return {Promise}
     */
    async release(version) {
        await this.add();
        await this.commit(`release: v${version}`);
        await this.tag(`v${version}`);
        await this.push(null, true);
    }

    /**
     * Get actual branch name.
     *
     * @returns {string}
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
     * @returns {string}
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
     * @returns {string}
     */
    getCommitMessage() {
        try {
            return execSync(`git -C ${this.cwd} log -1 --pretty=%B`).toString();
        } catch (err) {
            return null;
        }
    }

    /**
     * Check if the project has uncommitted changes.
     *
     * @return {boolean}
     */
    hasChanges() {
        try {
            return !!execSync(`git -C ${this.cwd} status -s`).toString().trim();
        } catch {
            return null;
        }
    }
}

module.exports = Git;
