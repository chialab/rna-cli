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
    }
};

module.exports = UTILS;