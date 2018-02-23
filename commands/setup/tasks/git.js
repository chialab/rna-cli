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
module.exports = (app, options) => {
    if (options.git !== false) {
        let cwd = paths.cwd;
        let gitPath = path.join(cwd, '.git');

        // Initialize repository if `.git` directory doesn't already exist.
        let init = fs.existsSync(gitPath) ? global.Promise.resolve(true) : git.init(cwd);

        return init.then(() =>
            git.getRemote(cwd)
                .then((res) => {
                    if (res) {
                        if (!options.force) {
                            app.log(`${colors.green('git project found.')} ${colors.grey(`(${res})`)}`);
                            return global.Promise.resolve();
                        }
                    }
                    return global.Promise.reject(res);
                })
                .catch((remote) => {
                    const prompt = inquirer.createPromptModule();
                    // Ask user if they already have a remote ready for their repo.
                    let opts = {
                        type: 'input',
                        name: 'repository',
                        message: `${colors.cyan('git')} > remote repository:`,
                    };
                    if (remote) {
                        opts.default = remote;
                    }
                    return prompt([opts]).then((answers) => {
                        if (answers.repository) {
                            // Configure remote.
                            return git.addRemote(cwd, answers.repository)
                                .then(() => {
                                    app.log(`${colors.green('git project created.')} ${colors.grey(`(${cwd})`)}`);
                                    return global.Promise.resolve();
                                });
                        }

                        // Remove remote.
                        // Is this needed? We don't end up here if a remote is configured already. ~~fquffio
                        return git.removeRemote(cwd)
                            .then(() => {
                                app.log(`${colors.green('git project created without remote.')} ${colors.grey(`(${cwd})`)}`);
                            });
                    }).then(() => {
                        // Write contents to `.gitignore`.
                        let gitIgnore = path.join(cwd, '.gitignore');
                        let content = fs.readFileSync(
                            path.join(paths.cli, './configs/git/gitignore'),
                            'utf8'
                        );

                        // "Append" configuration to `.gitignore`.
                        configurator(gitIgnore, content, '# RNA-CORE');

                        return global.Promise.resolve();
                    });
                })
        );
    }
    return global.Promise.resolve();
};
