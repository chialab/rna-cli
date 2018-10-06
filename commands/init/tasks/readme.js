const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Entry = require('../../../lib/entry.js');

/**
 * Ensure README file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function readmeTask(app, cwd, options) {
    const jsonFile = path.join(cwd, 'package.json');
    if (!fs.existsSync(jsonFile)) {
        return;
    }
    const json = require(jsonFile);
    let readme = path.join(cwd, 'README.md');
    if (fs.existsSync(readme) && !options.force) {
        // README already there: leave it as is.
        app.log(`${colors.green('readme found.')} ${colors.grey(`(${readme})`)}`);
        return;
    }

    let requirements = `### Requirements

* Node (>= 10)
* RNA cli (\`npm install @chialab/rna-cli\`)
`;

    let content = `# ${json.name}

${json.description || ''}
`;
    if (json.structure === 'webapp') {
        // README for Web applications.
        content += `${requirements}

### Build the project.

\`\`\`
$ rna install
$ rna build --production
\`\`\`

### Develpment mode.
\`\`\`
$ rna build --watch + serve ./public --watch
\`\`\`
`;
    } else if (json.structure === 'module') {
        // README for modules.
        content += `[![NPM](https://img.shields.io/npm/v/${json.name}.svg)](https://www.npmjs.com/package/${json.name})

## Install

\`\`\`sh
$ npm install ${json.name}
\`\`\`

## Development
${requirements}

### Build the project.

\`\`\`
$ rna install
$ rna build --production
\`\`\`

### Watch the project.
\`\`\`
$ rna install
$ rna build --watch
\`\`\`
`;
    } else if (json.structure === 'monorepo') {
        // README for repositories that contain multiple modules.
        let packages = Entry.resolve(cwd, []);
        if (packages.length) {
            content += `
| **Package** | **Path** | **Status** |
|---------|--------|--------|
${packages.map((entry) => `| ${entry.package.name} | ./${path.relative(cwd, entry.package.path)} | [![NPM](https://img.shields.io/npm/v/${entry.package.name}.svg)](https://www.npmjs.com/package/${entry.package.name}) |`).join('\n')}
`;
        }
        content += `
## Development
${requirements}

### Build all projects.

\`\`\`
$ rna install
$ rna build --production
\`\`\`

### Build projects selectively.

\`\`\`
$ rna install
$ rna build [package-name] [package-name] --production
\`\`\`

### Watch the projects.
\`\`\`
$ rna install
$ rna build --watch
\`\`\`
`;
    }

    // Write file contents.
    fs.writeFileSync(readme, content);
    app.log(`${colors.green('readme created.')} ${colors.grey(`(${readme})`)}`);
};
