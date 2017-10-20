const fs = require('fs');
const path = require('path');

function findCwd(p) {
    if (!p || p === '/') {
        return null;
    }
    let jsonPath = path.join(p, 'package.json');
    let gitPath = path.join(p, '.git');
    if (fs.existsSync(jsonPath) || fs.existsSync(gitPath)) {
        return p;
    }
    let dirname = path.dirname(p);
    return findCwd(dirname);
}

module.exports = {
    cwd: findCwd(process.cwd()),
    cli: path.resolve(__dirname, '..'),
};