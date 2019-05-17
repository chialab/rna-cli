const exec = require('./exec.js');

/**
 * @class PackageManager
 * A yarn helper for a project.
 * It uses child process for yarn commands.
 * It needs Yarn to be installed.
 */
class PackageManager {
    /**
     * Create a yarn helper instance.
     * @param {string} cwd The node project directory.
     * @return {PackageManager}
     */
    constructor(cwd = process.cwd()) {
        this.cwd = cwd;
    }

    /**
     * Run `yarn install` in project root.
     *
     * @returns {Promise}
     */
    async install() {
        return await exec('yarn', ['--cwd', this.cwd, 'install', '--ignore-scripts', '-W']);
    }

    /**
     * Run `yarn add` in project root.
     *
     * @param {string} ...packages Packages to be added.
     * @returns {Promise}
     */
    async add(...packages) {
        if (packages.length === 0) {
            // Nothing to add.
            throw new Error('specify the package to add');
        }
        return await exec('yarn', ['--cwd', this.cwd, 'add', ...packages, '--ignore-scripts', '-W']);
    }

    /**
     * Run `yarn add --dev` in project root.
     *
     * @param {string} ...packages Development packages to be added.
     * @returns {Promise}
     */
    async dev(...packages) {
        if (packages.length === 0) {
            // Nothing to add.
            throw new Error('specify the package to add');
        }
        return await exec('yarn', ['--cwd', this.cwd, 'add', ...packages, '--dev', '--ignore-scripts', '-W']);
    }

    /**
     * Run `yarn remove` in project root.
     *
     * @param {string} ...packages Packages to be removed.
     * @returns {Promise}
     */
    async remove(...packages) {
        if (packages.length === 0) {
            // Nothing to add.
            throw new Error('specify the package to add');
        }
        return await exec('yarn', ['--cwd', this.cwd, 'remove', ...packages, '--ignore-scripts', '-W']);
    }

    /**
     * Run `yarn start` in project root.
     *
     * @returns {Promise}
     */
    async start() {
        return await exec('yarn', ['--cwd', this.cwd, 'start']);
    }

    /**
     * Run `yarn test` in project root.
     *
     * @returns {Promise}
     */
    async test() {
        return await exec('yarn', ['--cwd', this.cwd, 'test']);
    }

    /**
     * Run a generic project command in project root.
     *
     * @param {string} cmd Project command to be run.
     * @param {Array<string>} args Arguments to be passed to command.
     * @returns {Promise}
     */
    async run(cmd, args = []) {
        return await exec('yarn', ['--cwd', this.cwd, 'run', cmd, ...args]);
    }

    /**
     * Change module version.
     *
     * @param {string} version The version to set.
     * @param {Array<string>} args Arguments to be passed to command.
     * @returns {Promise}
     */
    async version(version, args = []) {
        return await exec('yarn', ['--cwd', this.cwd, 'version', '--new-version', version, ...args]);
    }

    /**
     * Publish a module.
     *
     * @param {string} tag The tag to flag.
     * @return {Promise}
     */
    async publish(tag) {
        let args = tag ? ['--tag', tag] : [];
        return await exec('yarn', ['--cwd', this.cwd, 'publish', ...args]);
    }
}

module.exports = PackageManager;
