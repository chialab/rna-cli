const { File } = require('../File');
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
        options = Object.assign({}, options);

        let { input, output } = options;
        if (!input) {
            throw new Error(`missing "input" option for ${this.name}`);
        }
        if (!output) {
            throw new Error(`missing "output" option for ${this.name}`);
        }
        if (!Array.isArray(output)) {
            options.output = output = [output];
        }
        if (typeof input === 'string') {
            options.input = new File(input);
        }
        options.output = output.map((file) => {
            if (typeof file === 'string') {
                return new File(file, input.cwd);
            }
            return file;
        });

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        const { input, output = [] } = this.options;
        if (!input.exists()) {
            throw new Error(`missing "input" file ${input.localPath} for ${this.name}`);
        }

        this.addResources(input.path);

        this.emit(IconBundler.BUNDLE_START, input);
        this.emit(IconBundler.BUILD_START, input);

        this.result = await Promise.all(
            output.map(async (iconDefinition) => {
                let sourceBuffer = (await Jimp.read(input.path));
                if (iconDefinition.type === 'icon') {
                    let { file, name, size, gutter, background } = iconDefinition;
                    let iconBuffer = new Jimp(size, size, colorToString(background || { r: 255, g: 255, b: 255, alpha: 0 }));
                    iconBuffer.composite(sourceBuffer.resize(size - (gutter || 0), size - (gutter || 0)), (gutter || 0) / 2, (gutter || 0) / 2);
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
                throw new Error(`invalid icon type: ${iconDefinition.type}`);
            })
        );

        this.emit(IconBundler.BUILD_END, input, null);
        this.emit(IconBundler.BUNDLE_END, this.result);

        return this.result;
    }

    /**
     * @inheritdoc
     */
    async write() {
        this.emit(IconBundler.WRITE_START);
        let result = await Promise.all(
            this.result.map(async ({ file, buffer }) => {
                await buffer.writeAsync(file.path);
                this.emit(IconBundler.WRITE_PROGRESS, file);
                return file;
            })
        );
        this.emit(IconBundler.WRITE_END);
        await super.write();
        return result;
    }
}

module.exports = IconBundler;
