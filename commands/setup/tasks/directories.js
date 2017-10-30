const fs = require('fs');
const path = require('path');
const utils = require('../../../lib/utils.js');
const paths = require('../../../lib/paths.js');

module.exports = () => {
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
};