const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

const UTILS = {
    extractRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },
    ensureDir(dir) {
        let fullDir;
        let split = dir.split(path.sep);
        split.forEach((chunk, index) => {
            if (chunk) {
                if (index < (split.length - 1) || !chunk.match(/\./)) {
                    if (fullDir) {
                        fullDir = path.join(fullDir, chunk);
                    } else {
                        fullDir = chunk;
                    }
                    ensureDir(fullDir);
                }
            } else {
                fullDir = '/';
            }
        });
    },
    camelize(str) {
        return str.split('/').pop().replace(/(^[a-z0-9]|[-_]([a-z0-9]))/g, (g) => (g[1] || g[0]).toUpperCase());
    },
};

module.exports = UTILS;