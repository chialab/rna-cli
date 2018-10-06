const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const inquirer = require('inquirer');
const paths = require('../../../lib/paths.js');
const git = require('../../../lib/git.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure project is a Git repository.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function gitTask(app, options) {
    const cwd = paths.cwd;
    const gitPath = path.join(cwd, '.git');

    // Initialize repository if `.git` directory doesn't already exist.
    if (!fs.existsSync(gitPath)) {
        await git.init(cwd);
    }

    let remote;
    try {
        remote = await git.getRemote(cwd);
        if (remote && !options.force) {
            app.log(`${colors.green('git project found.')} ${colors.grey(`(${remote})`)}`);
            return;
        }
        throw remote;
    } catch(err) {
        let prompt = inquirer.createPromptModule();
        // Ask user if they already have a remote ready for their repo.
        let opts = {
            type: 'input',
            name: 'repository',
            message: `${colors.cyan('git')} > remote repository:`,
        };
        if (remote) {
            opts.default = remote;
        }
        let answers = await prompt([opts]);
        if (answers.repository) {
            // Configure remote.
            await git.addRemote(cwd, answers.repository);
            app.log(`${colors.green('git project created.')} ${colors.grey(`(${cwd})`)}`);
        } else {
            // Remove remote.
            // Is this needed? We don't end up here if a remote is configured already. ~~fquffio
            await git.removeRemote(cwd);
            app.log(`${colors.green('git project created without remote.')} ${colors.grey(`(${cwd})`)}`);
        }

        // Write contents to `.gitignore`.
        let gitIgnore = path.join(cwd, '.gitignore');
        let content = fs.readFileSync(
            path.join(paths.cli, './configs/git/gitignore'),
            'utf8'
        );

        // "Append" configuration to `.gitignore`.
        configurator(gitIgnore, content, '# RNA-CORE');
    }
};
