const colors = require('colors/safe');
const inquirer = require('inquirer');
const Git = require('../../../lib/Git.js');
const configurator = require('../../../lib/configurator.js');

/**
 * Ensure package is ready for the wonderful world of NPM.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function npmTask(app, options, project, templates) {
    const gitClient = new Git(project.path);
    const remote = project.get('repository.url') || await gitClient.getRemote();

    const formatQuestion = (msg) => `${colors.cyan('package')} > ${msg}:`;
    const prompt = inquirer.createPromptModule();

    // Ask user a shitload of questions about its new package.
    const answers = await prompt([
        {
            type: 'input',
            name: 'name',
            message: formatQuestion('name'),
            default: project.get('name'),
            validate: (input) => input.length > 0
                && input.length <= 214
                && !input.match(/A-Z/)
                && !input.match(/^[._]/)
                && !input.match(/^\s/)
                && !input.match(/\s$/)
                && !input.match(/[~)('!*]/),
        },
        {
            type: 'input',
            name: 'version',
            message: formatQuestion('version'),
            default: project.get('version') || '1.0.0',
            validate: (input) => /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/ig.test(input),
        },
        {
            type: 'input',
            name: 'description',
            message: formatQuestion('description'),
            default: project.get('description'),
        },
        {
            type: 'input',
            name: 'workspaces',
            message: formatQuestion('workspaces'),
            default: project.get('workspaces') && project.get('workspaces').join(', '),
            when: () => !project.parent,
        },
        {
            type: 'input',
            name: 'src',
            message: formatQuestion('src path'),
            default: project.get('directories.src'),
            when: (answers) => !answers.workspaces,
        },
        {
            type: 'input',
            name: 'lib',
            message: formatQuestion('distribution path'),
            default: project.get('directories.lib'),
            when: (answers) => !answers.workspaces,
        },
        {
            type: 'input',
            name: 'public',
            message: formatQuestion('public path'),
            default: project.get('directories.public'),
            when: (answers) => !answers.workspaces && !answers.lib,
        },
        {
            type: 'input',
            name: 'test',
            message: formatQuestion('test path'),
            default: project.get('directories.test'),
            when: (answers) => !answers.workspaces,
        },
        {
            type: 'input',
            name: 'module',
            message: formatQuestion('esm entry point'),
            default: project.get('module'),
            when: (answers) => !answers.workspaces,
        },
        {
            type: 'input',
            name: 'main',
            message: formatQuestion('commonjs entry point'),
            default: project.get('main'),
            when: (answers) => !answers.workspaces,
        },
        {
            type: 'input',
            name: 'style',
            message: formatQuestion('style entry point'),
            default: project.get('style'),
            when: (answers) => !answers.workspaces,
        },
        {
            type: 'input',
            name: 'author',
            message: formatQuestion('author'),
            default: project.get('author'),
        },
        {
            type: 'input',
            name: 'license',
            message: formatQuestion('license'),
            default: project.get('license') || 'MIT',
        },
    ]);

    // User answered all questions. Are we done here? Not quite yet…
    project.set({
        name: answers.name,
        version: answers.version,
        description: answers.description,
    });
    if (!project.get('directories')) {
        project.set('directories', {});
    }
    if (answers.src) {
        project.set('directories.src', answers.src);
    } else {
        project.unset('directories.src');
    }
    if (answers.lib) {
        project.set('directories.lib', answers.lib);
    } else {
        project.unset('directories.lib');
    }
    if (answers.public) {
        project.set('directories.public', answers.public);
    } else {
        project.unset('directories.public');
    }
    if (answers.test) {
        project.set('directories.test', answers.test);
    } else {
        project.unset('directories.test');
    }
    if (answers.main) {
        project.set('main', answers.main);
    }
    if (answers.module) {
        project.set('module', answers.module);
    }
    if (answers.style) {
        project.set('style', answers.style);
    }
    if (answers.workspaces) {
        project.set('workspaces', answers.workspaces.split(/,\s*/));
        project.set('private', true);
    } else {
        project.unset('workspaces');
    }
    if (!project.get('scripts')) {
        let scripts = {
            build: 'rna build --production',
            watch: 'rna build --watch',
            test: 'rna lint + unit',
            lint: 'rna lint',
            start: 'yarn install --ignore-scripts && rna build --watch',
            prepublish: 'yarn run build',
        };
        if (project.get('directories.public')) {
            scripts.watch += ' + serve --watch';
            scripts.start += ' + serve --watch';
            scripts.serve = 'rna serve';
        }
        project.set('scripts', scripts);
    }
    project.set({
        license: answers.license,
        author: answers.author,
    });

    if (answers.repository || remote) {
        project.setRepository(answers.repository || remote);
    }

    // Write `package.json`.
    project.save();

    if (!project.get('private')) {
        // NPMIGNORE
        const ignoreFile = project.file('.npmignore');
        const ignoreTemplate = templates.file('npmignore');

        // "Append" configuration to `.npmignore`.
        configurator(ignoreFile, ignoreTemplate.read(), '# RNA');
    }

    if (project.get('workspaces')) {
        const lernaJson = project.file('lerna.json');
        if (!lernaJson.exists()) {
            const lernaPackage = require('lerna/package.json');
            lernaJson.writeJson({
                lerna: lernaPackage.version,
                version: project.get('version') || '0.0.0',
                npmClient: 'yarn',
                useWorkspaces: true,
            });
        }
    }

    app.logger.success('package.json updated', project.localPath);
};
