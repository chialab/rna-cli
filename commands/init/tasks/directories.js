const fs = require('fs-extra');
const path = require('path');
const paths = require('../../../lib/paths.js');

/**
 * Ensure basic tree structure is present.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = async function directoriesTask() {
    const cwd = paths.cwd;
    const jsonFile = path.join(cwd, 'package.json');
    if (!fs.existsSync(jsonFile)) {
        // No `package.json` is present: nothing to do.
        return;
    }

    const json = require(jsonFile);
    // Ensure path specified in `package.json` "main" key is present.
    if (json.structure === 'webapp') {
        // Using a simple HTML file as main entrypoint.
        let publicDir = path.resolve(cwd, json.main);
        fs.ensureDirSync(publicDir);
        let index = path.join(publicDir, 'index.html');
        if (!fs.existsSync(index)) {
            fs.writeFileSync(index, `<html>
<head>
    <meta charset="UTF-8" />
    <title>${json.name}</title>
    <link rel="stylesheet" href="${json.style.split(path.sep).slice(1).join(path.sep).replace('.scss', '.css')}">
</head>
<body>
    <script src="${json.module.split(path.sep).slice(1).join(path.sep)}"></script>
</body>
</html>`);
        }
    }

    if (json.module) {
        // Ensure path specified in `package.json` "module" key is present.
        let mod = path.resolve(cwd, json.module);
        fs.ensureDirSync(path.dirname(mod));
        if (!fs.existsSync(mod)) {
            fs.writeFileSync(mod, '');
        }
    }

    if (json.style) {
        // Ensure path specified in `package.json` "style" key is present.
        let style = path.resolve(cwd, json.style);
        fs.ensureDirSync(path.dirname(style));
        if (!fs.existsSync(style)) {
            fs.writeFileSync(style, '');
        }
    }

    if (json.workspaces) {
        // Ensure paths listed as workspaces are present.
        json.workspaces.forEach((ws) => fs.ensureDirSync(path.dirname(ws)));
    }
};
