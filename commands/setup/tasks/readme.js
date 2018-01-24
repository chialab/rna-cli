const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');

/**
 * Ensure README file is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    if (options.readme !== false) {
        const cwd = paths.cwd;
        const jsonFile = path.join(cwd, 'package.json');
        if (!fs.existsSync(jsonFile)) {
            return global.Promise.resolve();
        }
        const json = require(jsonFile);
        let readme = path.join(cwd, 'README.md');
        if (fs.existsSync(readme) && !options.force) {
            // README already there: leave it as is.
            app.log(`${colors.green('readme found.')} ${colors.grey(`(${readme})`)}`);
            return global.Promise.resolve();
        }

        let requirements = `### Requirements

* Node (>= 6)
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
            let packages = require('../../../lib/packages.js');
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
    }
    return global.Promise.resolve();
};
