const fs = require('fs');
const path = require('path');
const os = require('os');
const { injectManifest } = require('workbox-build');

module.exports = function swPlugin(options = {}) {
    const tmpdir = os.tmpdir();

    if (!options.root) {
        throw 'missin "root" option';
    }

    return {
        name: 'sw',

        async renderChunk(code) {
            if (!code.match(/\.(precache|precacheAndRoute)\(\[\]\)/)) {
                return;
            }

            const hash = Date.now();
            const input = path.join(tmpdir, `input.${hash}.js`);
            const output = path.join(tmpdir, `output.${hash}.js`);
            let exclude = options.exclude;
            if (!exclude) {
                exclude = [];
            } else if (!Array.isArray(exclude)) {
                exclude = [exclude];
            }
            fs.writeFileSync(input, code);

            let error;
            try {
                await injectManifest({
                    swSrc: input,
                    swDest: output,
                    globDirectory: options.root,
                    globPatterns: ['**/*'],
                    globIgnores: exclude,
                    maximumFileSizeToCacheInBytes: 1024 * 1024 * 10,
                });
                code = fs.readFileSync(output, 'utf8');
            } catch (err) {
                error = err;
            }

            if (fs.existsSync(input)) {
                fs.unlinkSync(input);
            }

            if (fs.existsSync(output)) {
                fs.unlinkSync(output);
            }

            if (error) {
                throw error;
            }

            return {
                code,
                map: {
                    mappings: '',
                },
            };
        },
    };
};
