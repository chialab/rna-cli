const fs = require('fs-extra');
const path = require('path');

/**
 * Try to automatically detect project root starting from a path and moving up.
 *
 * @param {string} p Path to start searching from.
 * @returns {string}
 */
function findCwd(p) {
    if (!p || p === '/') {
        // This is a bit too much.
        return null;
    }

    let jsonPath = path.join(p, 'package.json');
    let gitPath = path.join(p, '.git');
    if (fs.existsSync(jsonPath) || fs.existsSync(gitPath)) {
        // Either a NPM package root, or a Git repository root.
        return p;
    }

    // Move up one level.
    let dirname = path.dirname(p);
    return findCwd(dirname);
}

// Ensure a directory exists in system's temporary directory.
let tmp = path.join(require('os').tmpdir(), 'rna');
fs.ensureDirSync(tmp);

module.exports = {
    /**
     * Project root.
     *
     * @var {string}
     */
    cwd: findCwd(process.cwd()),

    /**
     * CLI sources root.
     *
     * @var {string}
     */
    cli: path.resolve(__dirname, '..'),

    /**
     * Temporary directory.
     *
     * @var {string}
     */
    tmp,
};
