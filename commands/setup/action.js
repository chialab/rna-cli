const fs = require('fs');
const path = require('path');
const colors = require('colors');
const inquirer = require('inquirer');
const utils = require('../../lib/utils.js');
const paths = require('../../lib/paths.js');
const git = require('../../lib/git.js');
const manager = require('../../lib/package-manager.js');

let params = {};

function gitTask(app, options) {
    if (options.git !== false) {
        let cwd = paths.cwd;
        let gitPath = path.join(cwd, '.git');
        let init = fs.existsSync(gitPath) ? global.Promise.resolve(true) : git.init();
        return init.then(() =>
            git.getRemote()
                .then((res) => {
                    if (res) {
                        params.repository = res;
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
                            params.repository = answers.repository;
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
                    });
                })
        );
    }
    return global.Promise.resolve();
}

function npmTask(app, options) {
    let cwd = paths.cwd;
    const jsonFile = path.join(cwd, 'package.json');
    let json = {};
    if (fs.existsSync(jsonFile)) {
        json = require(jsonFile);
        json.structure = json.structure || (json.workspaces ? 'monorepo' : 'module');
    }
    params.json = json;
    if (options.npm !== false) {
        if (json.name) {
            if (!options.force) {
                app.log(`${colors.green('package.json found.')} ${colors.grey(`(${jsonFile})`)}`);
                return global.Promise.resolve();
            }
        }

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
                validate: (input) => /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z\-]+(?:\.[\da-z\-]+)*)?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?\b/ig.test(input),
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
            if (answers.workspaces) {
                json.workspaces = answers.workspaces.split(/,\s*/);
                json.private = true;
            }
            json.license = answers.license;
            json.author = answers.author;
            if (params.repository) {
                json.repository = json.repository || {};
                json.repository.type = json.repository.type || 'git';
                json.repository.url = params.repository || json.repository.url;
            }
            fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2));
            app.log(`${colors.green('package.json created.')} ${colors.grey(`(${jsonFile})`)}`);
            if (options.ignore !== false) {
                const PREFIX = '## RNA';
                // GITIGNORE
                let gitIgnore = path.join(cwd, '.gitignore');
                if (!fs.existsSync(gitIgnore)) {
                    fs.writeFileSync(gitIgnore, '');
                }
                let ignoreContent = fs.readFileSync(gitIgnore, 'utf8') || '';
                if (ignoreContent.indexOf(PREFIX) === -1) {
                    ignoreContent += `
${PREFIX}
/node_modules
/coverage
npm-debug.log${json.structure === 'module' ? `\n${path.dirname(json.main)}` : ''}
${json.structure === 'webapp' ? `\n${json.main.replace(path.extname(json.main), '.*{js,css,map}')}` : ''}`;
                    fs.writeFileSync(gitIgnore, ignoreContent);
                }
                // NPMIGNORE
                if (json.structure === 'module') {
                    let npmIgnore = path.join(cwd, '.npmignore');
                    if (!fs.existsSync(npmIgnore)) {
                        fs.writeFileSync(npmIgnore, '');
                    }
                    let npmIgnoreContent = fs.readFileSync(npmIgnore, 'utf8') || '';
                    if (npmIgnoreContent.indexOf(PREFIX) === -1) {
                        npmIgnoreContent += `
${PREFIX}
.*
/node_modules
/coverage
/test
rollup.config.js
sauce.browsers.js
karma.conf.js`;
                        fs.writeFileSync(npmIgnore, npmIgnoreContent);
                    }
                }
            }
        });
    }
    return global.Promise.resolve();
}

function directoriesTask() {
    let cwd = paths.cwd;
    const jsonFile = path.join(cwd, 'package.json');
    if (!fs.existsSync(jsonFile)) {
        return global.Promise.resolve();
    }
    const json = require(jsonFile);
    if (json.main) {
        let main = path.resolve(cwd, json.main);
        utils.ensureDir(path.dirname(main));
        if (!fs.existsSync(main)) {
            fs.writeFileSync(main, '');
            if (json.structure === 'webapp') {
                let publicDir = path.resolve(cwd, json.main.split(path.sep)[0]);
                let index = path.join(publicDir, 'index.html');
                if (!fs.existsSync(index)) {
                    fs.writeFileSync(index, `<html>
    <head>
        <meta charset="UTF-8" />
        <title>${json.name}</title>
    </head>
    <body>
        <script src="${json.main.split(path.sep).slice(1).join(path.sep)}"></script>
    </body>
</html>`);
                }
            }
        }
    }
    if (json.module) {
        let mod = path.resolve(cwd, json.module);
        utils.ensureDir(path.dirname(mod));
        if (!fs.existsSync(mod)) {
            fs.writeFileSync(mod, '');
        }
    }
    if (json.workspaces) {
        json.workspaces.forEach((ws) => utils.ensureDir(path.dirname(ws)));
    }
    return global.Promise.resolve();
}

function configTask(app, options) {
    if (options.config !== false) {
        const cwd = paths.cwd;
        let editorConfig = path.join(cwd, '.editorconfig');
        if (!fs.existsSync(editorConfig) || options.force) {
            let content = fs.readFileSync(
                path.join(paths.cli, './configs/.editorconfig'),
                'utf8'
            );
            fs.writeFileSync(editorConfig, content);
            app.log(`${colors.green('editorconfig created.')} ${colors.grey(`(${editorConfig})`)}`);
        } else {
            app.log(`${colors.green('editorconfig found.')} ${colors.grey(`(${editorConfig})`)}`);
        }
    }
    return global.Promise.resolve();
}

function lintingTask(app, options) {
    let eslintPromise = global.Promise.resolve();
    if (options.linting !== false) {
        const cwd = paths.cwd;
        // ESLINT
        let eslintConfig = path.join(cwd, '.eslintrc.yml');
        if (options.force || !fs.existsSync(eslintConfig)) {
            let content = fs.readFileSync(
                path.join(paths.cli, './configs/lint/eslintrc.yml'),
                'utf8'
            );
            fs.writeFileSync(eslintConfig, content);
            app.log(`${colors.green('eslint created.')} ${colors.grey(`(${eslintConfig})`)}`);
            eslintPromise = manager.dev('eslint-plugin-mocha');
        } else {
            app.log(`${colors.green('eslint found.')} ${colors.grey(`(${eslintConfig})`)}`);
        }
        // SASSLINT
        let sasslintConfig = path.join(cwd, '.sass-lint.yml');
        if (options.force || !fs.existsSync(sasslintConfig)) {
            let content = fs.readFileSync(
                path.join(paths.cli, './configs/lint/sass-lint.yml'),
                'utf8'
            );
            fs.writeFileSync(sasslintConfig, content);
            app.log(`${colors.green('sass-lint created.')} ${colors.grey(`(${sasslintConfig})`)}`);
        } else {
            app.log(`${colors.green('sass-lint found.')} ${colors.grey(`(${sasslintConfig})`)}`);
        }
    }
    return global.Promise.all([eslintPromise]);
}

function licenseTask(app, options) {
    if (options.license !== false) {
        const cwd = paths.cwd;
        const jsonFile = path.join(cwd, 'package.json');
        if (!fs.existsSync(jsonFile)) {
            return global.Promise.resolve();
        }
        const json = require(jsonFile);
        const license = path.join(cwd, 'LICENSE');
        if (!fs.existsSync(license) || options.force) {
            let licenseCode = json.license.toLowerCase();
            if (licenseCode !== 'unlicensed') {
                let list = require('spdx-license-list/spdx-full.json');
                let licenses = {};
                Object.keys(list).forEach((key) => {
                    licenses[key.toLowerCase()] = list[key].licenseText;
                });
                let text = licenses[licenseCode];
                if (text) {
                    text = text.replace(/<year>/gi, (new Date()).getFullYear());
                    if (json.author) {
                        text = text.replace(/<(owner|author|copyright\sholders)>/gi, json.author);
                    }
                    fs.writeFileSync(license, text);
                    app.log(`${colors.green('license created.')} ${colors.grey(`(${license})`)}`);
                } else {
                    app.log(`${colors.red('invalid license.')} ${colors.grey(`(${jsonFile})`)}`);
                }
            } else {
                app.log(`${colors.yellow('no license found.')} ${colors.grey(`(${jsonFile})`)}`);
            }
        } else {
            app.log(`${colors.green('license found.')} ${colors.grey(`(${license})`)}`);
        }
    }
    return global.Promise.resolve();
}

function readmeTask(app, options) {
    if (options.readme !== false) {
        const cwd = paths.cwd;
        let readme = path.join(cwd, 'README.md');
        if (fs.existsSync(readme) && !options.force) {
            app.log(`${colors.green('readme found.')} ${colors.grey(`(${readme})`)}`);
            return global.Promise.resolve();
        }
        const json = params.json;

        let requirements = `### Requirements

* Node (>= 6)
* RNA cli ([https://gitlab.com/chialab/rna-cli](https://gitlab.com/chialab/rna-cli))
`;

        let content = `# ${json.name}

${json.description || ''}
`;
        if (json.structure === 'webapp') {
            content += `${requirements}

### Build the project.

\`\`\`
$ rna bootstrap
$ rna build --production --external-css
\`\`\`

### Develpment mode.
\`\`\`
$ rna start
\`\`\`
`;
        } else if (json.structure === 'module') {
            content += `[![NPM](https://img.shields.io/npm/v/${json.name}.svg)](https://www.npmjs.com/package/${json.name})

## Install

\`\`\`sh
$ npm install ${json.name}
\`\`\`

## Development
${requirements}

### Build the project.

\`\`\`
$ rna bootstrap
$ rna build --production
\`\`\`

### Watch the project.
\`\`\`
$ rna bootstrap
$ rna watch
\`\`\`
`;
        } else if (json.structure === 'monorepo') {
            let packages = require('../../lib/packages.js');
            if (Object.keys(packages).length) {
                content += `
| **Package** | **Path** | **Status** |
|---------|--------|--------|
${Object.keys(packages).map((p) => `| ${packages[p].name} | ./${path.relative(cwd, p)} | [![NPM](https://img.shields.io/npm/v/${packages[p].name}.svg)](https://www.npmjs.com/package/${packages[p].name}) |`).join('\n')}
`;
            }
            content += `
## Development
${requirements}

### Build all projects.

\`\`\`
$ rna bootstrap
$ rna build --production
\`\`\`

### Build projects selectively.

\`\`\`
$ rna bootstrap
$ rna build [package-name] [package-name] --production
\`\`\`

### Watch the projects.
\`\`\`
$ rna bootstrap
$ rna watch
\`\`\`
`;
        }

        fs.writeFileSync(readme, content);
        app.log(`${colors.green('readme created.')} ${colors.grey(`(${readme})`)}`);
    }
    return global.Promise.resolve();
}

module.exports = (app, options) => {
    params = {};
    paths.cwd = options.arguments.length ? path.resolve(process.cwd(), options.arguments[0]) : paths.cwd;
    utils.ensureDir(paths.cwd);
    return gitTask(app, options)
        .then(() => npmTask(app, options))
        .then(() => directoriesTask(app, options))
        .then(() => configTask(app, options))
        .then(() => lintingTask(app, options))
        .then(() => licenseTask(app, options))
        .then(() => readmeTask(app, options));
};