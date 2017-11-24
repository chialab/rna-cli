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
module.exports = () => {
    let cwd = paths.cwd;
    const jsonFile = path.join(cwd, 'package.json');
    if (!fs.existsSync(jsonFile)) {
        // No `package.json` is present: nothing to do.
        return global.Promise.resolve();
    }
    const json = require(jsonFile);

    if (json.main) {
        // Ensure path specified in `package.json` "main" key is present.
        let main = path.resolve(cwd, json.main);
        fs.ensureDirSync(path.dirname(main));
        if (!fs.existsSync(main)) {
            fs.writeFileSync(main, '');
            if (json.structure === 'webapp') {
                // Using a simple HTML file as main entrypoint.
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
        // Ensure path specified in `package.json` "module" key is present.
        let mod = path.resolve(cwd, json.module);
        fs.ensureDirSync(path.dirname(mod));
        if (!fs.existsSync(mod)) {
            fs.writeFileSync(mod, '');
        }
    }

    if (json.workspaces) {
        // Ensure paths listed as workspaces are present.
        json.workspaces.forEach((ws) => fs.ensureDirSync(path.dirname(ws)));
    }

    return global.Promise.resolve();
};
