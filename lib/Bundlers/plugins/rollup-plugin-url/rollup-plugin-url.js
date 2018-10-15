const fs = require('fs-extra');
const { createFilter } = require('rollup-pluginutils');
const crypto = require('crypto');
const path = require('path');

const defaultInclude = [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.gif',
];

module.exports = function url(options = {}) {
    const {
        include = defaultInclude,
        exclude,
        publicPath = '',
    } = options;
    const filter = createFilter(include, exclude);
    const copies = Object.create(null);

    return {
        async load(id) {
            if (!filter(id)) {
                return null;
            }
            const buffer = await fs.readFile(id);
            const hash = crypto.createHash('sha1')
                .update(buffer)
                .digest('hex')
                .substr(0, 16);
            const ext = path.extname(id);
            const filename = `${path.basename(id, ext)}-${hash}${ext}`;
            const data = `${publicPath}${filename}`;
            copies[id] = filename;
            return `export default '${data}'`;
        },
        async generateBundle(options) {
            const base = options.dir || path.dirname(options.file);
            await fs.ensureDir(base);
            for (let id in copies) {
                await fs.copy(id, path.join(base, copies[id]));
            }
        },
    };
};
