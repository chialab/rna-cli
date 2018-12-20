const fs = require('fs-extra');
const { createFilter } = require('rollup-pluginutils');
const path = require('path');

const defaultInclude = [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.gif',
];

/**
 * @TODO remove after https://github.com/rollup/rollup/issues/2603 resolution
 */
const WORKAROUND = `if (typeof document !== 'undefined') {
    if (document.currentScript && document.currentScript.src) {
        document.currentScript.src = document.currentScript.src.split('?')[0];
    } else {
        document.baseURI = document.baseURI.split('?')[0];
    }
}`;

function url(options = {}) {
    const filter = createFilter(options.include || defaultInclude, options.exclude);

    return {
        async load(id) {
            if (!filter(id)) {
                return null;
            }
            let buffer = await fs.readFile(id);
            let asset = this.emitAsset(path.basename(id), buffer);
            return `${WORKAROUND}\nexport default import.meta.ROLLUP_ASSET_URL_${asset};`;
        },
    };
}

url.WORKAROUND = WORKAROUND;

module.exports = url;
