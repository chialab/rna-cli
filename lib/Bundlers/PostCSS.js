const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const unset = require('postcss-all-unset');
const cssnano = require('cssnano');
const stylelint = require('./plugins/postcss-stylelint-plugin/postcss-stylelint-plugin.js');
const sass = require('./plugins/postcss-dart-sass/postcss-dart-sass.js');

class PostCSS {
    constructor(options = {}) {
        this.options = Object.assign({}, options);
    }

    async build(options = {}) {
        options = Object.assign({}, this.options, options);

        if (fs.existsSync(`${options.output}.map`)) {
            fs.unlinkSync(`${options.output}.map`);
        }

        let postCssPlugins = [];
        if (options.lint !== false) {
            postCssPlugins.push(
                stylelint(),
            );
        }
        postCssPlugins.push(
            sass({
                includePaths: ['node_modules'],
                importer: require('./plugins/sass-resolver/sass-resolver')(),
                omitSourceMapUrl: true,
                sourceMapContents: true,
                sourceMapEmbed: false,
                sourceMap: !options.map,
            }),
            autoprefixer({
                browsers: options.targets,
                grid: true,
                flexbox: true,
                remove: false,
            }),
            unset(),
        );
        if (options.production) {
            postCssPlugins.push(
                cssnano({
                    discardUnused: false,
                    reduceIdents: false,
                    zindex: false,
                })
            );
        }
        let data = fs.readFileSync(options.input, 'utf8');
        this.result = await postcss(postCssPlugins)
            .process(data, {
                from: options.input,
                to: options.output,
                map: options.map !== false ? {
                    inline: options.map === 'inline',
                    sourcesContent: true,
                } : false,
            });

        return this.result;
    }

    async write() {
        if (this.options.output) {
            fs.ensureDirSync(path.dirname(this.options.output));
            fs.writeFileSync(this.options.output, this.result.css.toString());
            if (this.options.map !== false && this.options.map !== 'inline' && this.result.map) {
                fs.writeFileSync(`${this.options.output}.map`, this.result.map);
            }
        }
    }

    get linter() {
        if (!this.result) {
            return null;
        }

        return this.result.linter;
    }

    get files() {
        return [
            this.options.input,
            ...this.result.messages
                .filter((msg) => msg.type === 'dependency')
                .map((msg) => msg.file),
        ];
    }
}

module.exports = PostCSS;
