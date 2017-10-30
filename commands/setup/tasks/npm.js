const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const inquirer = require('inquirer');
const paths = require('../../../lib/paths.js');
const git = require('../../lib/git.js');
const configurator = require('../../../lib/configurator.js');

module.exports = (app, options) => {
    let cwd = paths.cwd;
    const jsonFile = path.join(cwd, 'package.json');
    let json = {};
    if (fs.existsSync(jsonFile)) {
        json = require(jsonFile);
        json.structure = json.structure || (json.workspaces ? 'monorepo' : 'module');
    }
    if (options.npm !== false) {
        if (json.name) {
            if (!options.force) {
                app.log(`${colors.green('package.json found.')} ${colors.grey(`(${jsonFile})`)}`);
                return global.Promise.resolve();
            }
        }

        return git.getRemote((remote) => {
            const formatQuestion = (msg) => `${colors.cyan('package')} > ${msg}:`;
            const prompt = inquirer.createPromptModule();

            return prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: formatQuestion('name'),
                    default: json.name || path.basename(cwd),
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
                    default: '1.0.0',
                    validate: (input) => /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/ig.test(input),
                },
                {
                    type: 'input',
                    name: 'description',
                    message: formatQuestion('description'),
                    default: json.description,
                },
                {
                    type: 'list',
                    name: 'structure',
                    message: formatQuestion('structure'),
                    choices: ['module', 'monorepo', 'webapp'],
                    default: ['module', 'monorepo', 'webapp'].indexOf(json.structure) || 0,
                },
                {
                    type: 'input',
                    name: 'module',
                    message: formatQuestion('source entry point'),
                    default: json.module || 'src/index.js',
                    when: (answers) => answers.structure === 'module' || answers.structure === 'webapp',
                },
                {
                    type: 'input',
                    name: 'main',
                    message: formatQuestion('entry point'),
                    default: json.main || 'dist/index.js',
                    when: (answers) => answers.structure === 'module',
                },
                {
                    type: 'input',
                    name: 'main',
                    message: formatQuestion('entry point'),
                    default: json.main || 'public/index.js',
                    when: (answers) => answers.structure === 'webapp',
                },
                {
                    type: 'input',
                    name: 'workspaces',
                    message: formatQuestion('workspaces'),
                    default: json.workspaces && json.workspaces.join(', ') || 'packages/*',
                    when: (answers) => answers.structure === 'monorepo',
                },
                {
                    type: 'input',
                    name: 'author',
                    message: formatQuestion('author'),
                    default: json.author,
                },
                {
                    type: 'input',
                    name: 'license',
                    message: formatQuestion('license'),
                    default: json.license || 'MIT',
                },
            ]).then((answers) => {
                json.name = answers.name;
                json.version = answers.json;
                json.description = answers.description || '';
                json.structure = answers.structure;
                if (answers.main) {
                    json.main = answers.main;
                }
                if (answers.module) {
                    json.module = answers.module;
                }
                if (remote) {
                    json.workspaces = answers.workspaces.split(/,\s*/);
                    json.private = true;
                }
                json.license = answers.license;
                json.author = answers.author;
                if (answers.repository) {
                    json.repository = json.repository || {};
                    json.repository.type = json.repository.type || 'git';
                    json.repository.url = answers.repository || json.repository.url;
                }
                fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2));
                app.log(`${colors.green('package.json created.')} ${colors.grey(`(${jsonFile})`)}`);
                if (options.ignore !== false) {
                    // GITIGNORE
                    let gitIgnore = path.join(cwd, '.gitignore');
                    let content = '';
                    if (json.structure === 'module') {
                        content = path.dirname(json.main);
                    } else if (json.structure === 'webapp') {
                        content = json.main.replace(path.extname(json.main), '.*{js,css,map}');
                    }
                    configurator(gitIgnore, content, '# RNA-STRUCTURE');
                    // NPMIGNORE
                    let npmIgnore = path.join(cwd, '.npmignore');
                    content = fs.readFileSync(
                        path.join(paths.cli, './configs/git/npmignore'),
                        'utf8'
                    );
                    configurator(npmIgnore, content, '# RNA-STRUCTURE');
                }
            });
        });
    }
    return global.Promise.resolve();
};