const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const inquirer = require('inquirer');
const paths = require('../../lib/paths.js');
const git = require('../../lib/git.js');
const configurator = require('../../../lib/configurator.js');

module.exports = (app, options) => {
    if (options.git !== false) {
        let cwd = paths.cwd;
        let gitPath = path.join(cwd, '.git');
        let init = fs.existsSync(gitPath) ? global.Promise.resolve(true) : git.init();
        return init.then(() =>
            git.getRemote()
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
                            return git.addRemote(answers.repository)
                                .then(() => {
                                    app.log(`${colors.green('git project created.')} ${colors.grey(`(${cwd})`)}`);
                                    return global.Promise.resolve();
                                });
                        }
                        return git.removeRemote()
                            .then(() => {
                                app.log(`${colors.green('git project created without remote.')} ${colors.grey(`(${cwd})`)}`);
                            });
                    }).then(() => {
                        let gitIgnore = path.join(cwd, '.gitignore');
                        let content = fs.readFileSync(
                            path.join(paths.cli, './configs/git/gitignore'),
                            'utf8'
                        );
                        configurator(gitIgnore, content, '# RNA-CORE');
                        return global.Promise.resolve();
                    });
                })
        );
    }
    return global.Promise.resolve();
};