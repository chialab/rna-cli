const fs = require('fs-extra');
const path = require('path');
const SHARP_PATH = require.resolve('sharp');

/**
 * @typedef {Object} Color
 * @property {number} r Red value [0-255]
 * @property {number} g Green value [0-255]
 * @property {number} b Blue value [0-255]
 * @property {number} alpha Alpha value [0-255]
 */

/**
 * @typedef {Object} IconDescriptor
 * @property {string} name The filename
 * @property {number} size The size of the icon
 * @property {number} gutter The margin between the icon edge and the input image
 * @property {number} round The rounded corner value
 * @property {Color}  background The background color of the icon
 */

/**
 * Generate icons.
 *
 * @param {string} input The icon source image.
 * @param {string} output The output folder for generated icons.
 * @param {Object<string, IconDescriptor>} presets Custom presets configurations.
 * @return {Promise}
 */
module.exports = function(input, output, presets = {}) {
    const sharp = require(SHARP_PATH);
    // ensure the output dir exists
    fs.ensureDirSync(output);
    return Promise.all(
        Object.keys(presets).map(async (k) => {

            // merge preset options
            let options = Object.assign({}, presets[k]);
            let dest = path.join(output, options.name);
            // load the icon source
            let buffer = await sharp(input)
                // resize the image
                .resize(options.size - (options.gutter || 0))
                .png().toBuffer();

            // create the first level with the background color
            buffer = await sharp({
                create: {
                    width: options.size,
                    height: options.size,
                    channels: 4,
                    background: options.background || { r: 0, g: 0, b: 0, alpha: 0 },
                },
            })
                // add the icon
                .overlayWith(buffer, {
                    gravity: sharp.gravity.centre,
                    density: 300,
                })
                .png().toBuffer();

            if (options.round) {
                // mask the icon with an svg with rounded corners
                let roundedContent = `<svg><rect x="0" y="0" width="${options.size}" height="${options.size}" rx="${options.round}" ry="${options.round}"/></svg>`;
                let roundedCorners = Buffer.alloc(roundedContent.length, roundedContent);
                buffer = await sharp(buffer)
                    .overlayWith(roundedCorners, { cutout: true })
                    .png().toBuffer();
            }

            // save the file
            await sharp(buffer).toFile(dest);

            return {
                src: dest,
                size: options.size,
            };
        })
    ).then((result) => {
        if (require.cache[SHARP_PATH]) {
            delete require.cache[SHARP_PATH];
        }
        return result;
    });
};
