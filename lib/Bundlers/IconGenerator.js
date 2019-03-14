const { existsSync, ensureFile } = require('fs-extra');
const { EventEmitter } = require('events');
const Jimp = require('jimp');

function colorToString({ r, g, b, alpha }) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate icon files.
 */
class IconGenerator extends EventEmitter {
    /**
     * Create an icon generator instance.
     * @param {IconOptions} options A set of options for the icon generatir.
     */
    constructor(options = {}) {
        super();
        this.options = Object.assign({}, options);
    }

    /**
     * A list of resources used by the bundler.
     * @type {Array<string>}
     */
    get files() {
        if (!this.options.input) {
            return [];
        }
        return [this.options.input];
    }

    /**
     * Build the icon files.
     * @return {Promise<void>}
     */
    async build() {
        let { input, output } = this.options;
        if (!input) {
            throw 'missing "input" option';
        }
        if (!existsSync(input)) {
            throw 'missing "input" file';
        }

        output = output || [];

        this.result = await Promise.all(
            output.map(async (iconDefinition) => {
                let sourceBuffer = (await Jimp.read(input));
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

        return this.result;
    }

    /**
     * Write icon results.
     * @return {Promise<void>}
     */
    async write() {
        await Promise.all(
            this.result.map(async ({ file, buffer }) => {
                await ensureFile(file);
                await buffer.write(file);
            })
        );
    }
}

module.exports = IconGenerator;
