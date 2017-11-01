const fs = require('fs');
const path = require('path');
const glob = require('glob').sync;
const cwd = require('./paths.js').cwd;

let res = {};

// Load root `package.json`.
let mainPath = path.join(cwd, 'package.json');
if (fs.existsSync(mainPath)) {
    res[cwd] = require(mainPath);
}

if (res[cwd] && res[cwd].workspaces) {
    // Load each workspace's `package.json`.
    res[cwd].workspaces.forEach((p) => {
        glob(path.join(cwd, p)).forEach((wd) => {
            let jsonPath = path.join(wd, 'package.json');
            if (fs.existsSync(jsonPath)) {
                res[wd] = require(jsonPath);
            }
        });
    });
    delete res[cwd];
}

module.exports = res;
