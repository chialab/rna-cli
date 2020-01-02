const colors = require('colors/safe');
const inquirer = require('inquirer');
const { configurator } = require('../utils/index.js');

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
    // Initialize repository if `.git` directory doesn't already exist.
    if (!project.git.check()) {
        await project.git.init();
    }

    let remote = (await project.git.getRemote()) || project.get('repository.url');
    if (!remote) {
        const prompt = inquirer.createPromptModule();
        // Ask user if they already have a remote ready for their repo.
        const answers = await prompt([{
            type: 'input',
            name: 'repository',
            message: `${colors.cyan('git')} > remote repository:`,
        }]);
        remote = answers.repository;
    }

    if (!remote) {
        await project.git.removeRemote();
    } else {
        // Configure remote.
        await project.git.addRemote(remote);
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
