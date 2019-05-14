const fs = require('fs-extra');
const { createFilter } = require('rollup-pluginutils');
const path = require('path');

const defaultInclude = [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.gif',
];

function getResolveUrl(path, URL) {
    if (URL === void 0) {
        URL = 'URL';
    }
    return `new (require('u' + 'rl').URL)('${path}').href`;
}

function getRelativeUrlFromDocument(relativePath) {
    return `new URL((document.currentScript && document.currentScript.src.split('?')[0] || (document.baseURI && document.baseURI.split('?')[0]) || '') + '/../${relativePath}').href`;
}

function url(options = {}) {
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

        resolveFileUrl({ relativePath, format }) {
            if (format !== 'cjs' && format !== 'umd') {
                return;
            }
            return `(typeof document === 'undefined' ? ${getResolveUrl(`file:${__dirname}/${relativePath}`, '(require(\'u\' + \'rl\').URL)')} : ${getRelativeUrlFromDocument(relativePath)});`;
        },
    };
}

module.exports = url;
