const Bundler = require('./Bundler');
const Jimp = require('jimp');

/**
 * @typedef {Object} Color
 * @property {number} r Red value [0-255]
 * @property {number} g Green value [0-255]
 * @property {number} b Blue value [0-255]
 * @property {number} alpha Alpha value [0-1]
 */

/**
 * @typedef {Object} Icon
 * @property {string} name The filename
 * @property {number} size The size of the icon
 * @property {number} gutter The margin between the icon edge and the input image
 * @property {number} round The rounded corner value
 * @property {Color}  background The background color of the icon
 * @property {string} type = 'icon'
 */

/**
 * @typedef {Object} Splash
 * @property {string} name The filename
 * @property {number} width The width of the icon
 * @property {number} height The size of the icon
 * @property {Color}  background The background color of the icon
 * @property {string} type = 'splash'
 */

/**
 * @typedef {Icon|Splash} IconDefinition
 */

/**
 * Convert color to CSS rgba string.
 * @param {Color} color The color to convert.
 * @return {string}
 */
function colorToString({ r, g, b, alpha }) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate icon files.
 */
class IconBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        let { input } = options;
        if (!input) {
            throw 'missing "input" option';
        }
        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        let input = this.options.get('input');
        if (!input.exists()) {
            throw 'missing "input" file';
        }

        this.addResources(input.path);

        let output = this.options.get('output') || [];
        let logger = this.getLogger();

        logger.play('generating icons...');

        this.result = await Promise.all(
            output.map(async (iconDefinition) => {
                let sourceBuffer = (await Jimp.read(input.path));
                if (iconDefinition.type === 'icon') {
                    let { file, name, size, gutter, background } = iconDefinition;
                    let iconBuffer = new Jimp(size, size, colorToString(background || { r: 255, g: 255, b: 255, alpha: 0 }));
                    iconBuffer.composite(sourceBuffer.resize(size, size), (gutter || 0) / 2, (gutter || 0) / 2);
                    return {
                        file,
                        name,
                        size,
                        buffer: iconBuffer,
                    };
                } else if (iconDefinition.type === 'splash') {
                    let { file, name, width, height, gutter, background } = iconDefinition;
                    let size = Math.round(Math.min(height / 6, width / 6)) - (gutter || 0);
                    let splashBuffer = new Jimp(width, height, colorToString(background || { r: 255, g: 255, b: 255, alpha: 1 }));
                    splashBuffer.composite(sourceBuffer.resize(size, size), (width - size) / 2, (height - size) / 2);
                    return {
                        file,
                        name,
                        width,
                        height,
                        size,
                        buffer: splashBuffer,
                    };
                }
                throw `invalid icon type: ${iconDefinition.type}`;
            })
        );

        await Promise.all(
            this.result.map(async ({ file, buffer }) => {
                await buffer.write(file.path);
                let { size, zipped } = file.size;
                logger.info(file.localPath, `${size}, ${zipped} zipped`);
            })
        );

        logger.stop();
        logger.success('icons ready');

        return this.result;
    }
}

module.exports = IconBundler;
