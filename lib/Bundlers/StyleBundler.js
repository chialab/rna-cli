const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const unset = require('postcss-all-unset');
const cssnano = require('cssnano');
const focusVisible = require('postcss-focus-visible');
const focusWithin = require('postcss-focus-within');
const Bundler = require('./Bundler');
const StyleLint = require('../Linters/Stylelint');
const stylelintPlugin = require('./plugins/postcss-stylelint-plugin/postcss-stylelint-plugin.js');
const sass = require('./plugins/postcss-dart-sass/postcss-dart-sass.js');
const sassSyntax = require('postcss-scss');

class StyleBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        await super.setup(options);

        const plugins = options.plugins || [];

        plugins.push(
            sass({
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
            focusVisible(),
            focusWithin({
                replaceWith: '.focus-within',
            }),
        );

        if (options.production) {
            plugins.push(
                cssnano({
                    preset: ['default', {
                        discardUnused: false,
                        reduceIdents: false,
                        mergeRules: false,
                        zindex: false,
                    }],
                })
            );
        }

        if (options.lint !== false) {
            plugins.push(
                stylelintPlugin(StyleLint.detectConfig(this.app, this.project)),
            );
        }

        this.options.set('plugins', plugins);
        this.options.set('syntax', sassSyntax);
        this.options.set('parser', sassSyntax);
    }

    /**
     * @inheritdoc
     */
    async build() {
        let input = this.options.get('input');

        if (!input.exists()) {
            throw 'missing "input" file';
        }

        let profile = this.getProfiler();
        let logger = this.getLogger();

        try {
            let output = this.options.get('output');
            let map = this.options.get('map');

            this.addResources(input.path);

            logger.play('postcss...', input.localPath);

            if (output && output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let data = input.read();
            let config = {
                from: input.path,
                to: output ? output.path : null,
                syntax: this.options.get('syntax'),
                parser: this.options.get('parser'),
                map: map !== false ? {
                    inline: map === 'inline',
                    sourcesContent: true,
                } : false,
            };

            this.result = await postcss(this.options.get('plugins') || []).process(data, config);
            this.addResources(...(this.result.dependencies || []));

            if (output) {
                let externalMapFile = map !== false && map !== 'inline' && this.result.map;
                let content = this.result.css.toString();
                if (externalMapFile) {
                    content += `\n/*# sourceMappingURL=${output.basename}.map */`;
                    output.mapFile.write(this.result.map);
                }

                output.write(content);
            }

            logger.stop();
            profile.end();

            if (this.linter && (this.linter.hasErrors() || this.linter.hasWarnings())) {
                logger.log(this.linter.report());
            }

            if (output) {
                let { size, zipped } = output.size;
                logger.info(output.localPath, `${size}, ${zipped} zipped`);
            }

            logger.success('css ready');

            return this.result;
        }  catch (error) {
            logger.stop();
            profile.end();
            throw error;
        }
    }

    get linter() {
        if (!this.result) {
            return null;
        }

        return this.result.linter;
    }

    get files() {
        if (!this.result) {
            return [this.options.input];
        }

        return [
            this.options.input,
            ...(this.result.dependencies || []),
        ];
    }
}

module.exports = StyleBundler;
