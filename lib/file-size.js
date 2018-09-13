const fs = require('fs-extra');
const path = require('path');
const gzipSize = require('gzip-size');
const colors = require('colors/safe');

const KILO = 1024;
const MEGA = KILO ** 2;
const TERA = KILO ** 3;

function prettyByte(size) {
    if (size > TERA) {
        return `${(size / TERA).toFixed(1)} TB`;
    } else if (size > MEGA) {
        return `${(size / MEGA).toFixed(1)} MB`;
    } else if (size > KILO) {
        return `${(size / KILO).toFixed(1)} KB`;
    }
    return `${size} B`;
}

module.exports = function fileSize(file) {
    let stats = fs.statSync(file);
    if (stats.isDirectory()) {
        return fs.readdirSync(file)
            .map((child) => path.join(file, child))
            .filter((child) => fs.statSync(child).isFile())
            .map((child) => fileSize(child))
            .join('\n');
    }
    let size = fs.statSync(file).size;
    let gzip = gzipSize.fileSync(file);
    return `${path.relative(process.cwd(), file)} ${colors.grey(`(${prettyByte(size)}, ${prettyByte(gzip)} zipped)`)}`;
};
