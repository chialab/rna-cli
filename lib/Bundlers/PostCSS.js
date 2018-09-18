const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const unset = require('postcss-all-unset');
const cssnano = require('cssnano');
const stylelint = require('./plugins/postcss-stylelint-plugin/postcss-stylelint-plugin.js');
const sass = require('./plugins/postcss-dart-sass/postcss-dart-sass.js');
const BundleManifest = require('../bundle.js');

module.exports = class PostCSS {
    get linter() {
        if (!this.result) {
            return null;
        }

        return this.result.linter;
    }

    constructor(options = {}) {
        this.options = Object.assign({}, options);
    }

    async build(options = {}) {
        options = Object.assign({}, this.options, options);
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
        let result = this.result = await postcss(postCssPlugins)
            .process(data, {
                from: options.input,
                to: options.output,
                map: options.map !== false ? {
                    inline: options.map === 'inline',
                    sourcesContent: true,
                } : false,
            });

        let manifest = new BundleManifest(options.input, options.output);
        manifest.css = result.css.toString();
        manifest.map = result.map;
        if (result.messages) {
            let dependencies = result.messages
                .filter((msg) => msg.type === 'dependency')
                .map((msg) => msg.file);
            manifest.addFile(...dependencies);
        }

        if (options.output) {
            fs.ensureDirSync(path.dirname(options.output));
            fs.writeFileSync(options.output, manifest.css);
            if (options.map !== false && options.map !== 'inline' && manifest.map) {
                fs.writeFileSync(`${options.output}.map`, manifest.map);
            }
        }

        return manifest;
    }
};
