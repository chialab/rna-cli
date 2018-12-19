const fs = require('fs-extra');
const { createFilter } = require('rollup-pluginutils');
const path = require('path');

const defaultInclude = [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.gif',
];

module.exports = function url(options = {}) {
    const filter = createFilter(options.include || defaultInclude, options.exclude);

    return {
        async load(id) {
            if (!filter(id)) {
                return null;
            }
            let buffer = await fs.readFile(id);
            let asset = this.emitAsset(path.basename(id), buffer);
            return `export default import.meta.ROLLUP_ASSET_URL_${asset};`;
        },
    };
};
