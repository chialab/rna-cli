const colors = require('colors/safe');
const inquirer = require('inquirer');
const Git = require('../../../lib/Git.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure project is a Git repository.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function gitTask(app, options, project, templates) {
    const gitPath = project.directory('.git');
    const gitClient = new Git(project.path);

    // Initialize repository if `.git` directory doesn't already exist.
    if (!gitPath.exists()) {
        await gitClient.init();
    }

    let remote = project.get('repository.url');
    if (!remote) {
        let prompt = inquirer.createPromptModule();
        // Ask user if they already have a remote ready for their repo.
        let opts = {
            type: 'input',
            name: 'repository',
            message: `${colors.cyan('git')} > remote repository:`,
        };
        let answers = await prompt([opts]);
        remote = answers.repository;
    }

    if (!remote) {
        await gitClient.removeRemote();
    } else {
        // Configure remote.
        await gitClient.addRemote(remote);
        project.setRepository(remote);
        project.save();
    }

    // Write contents to `.gitignore`.
    let gitIgnore = project.file('.gitignore');
    let ignoreTemplate = templates.file('gitignore');

    // "Append" configuration to `.gitignore`.
    configurator(gitIgnore, ignoreTemplate.read(), '# RNA');

    app.logger.success('git project updated', project.localPath);
};
