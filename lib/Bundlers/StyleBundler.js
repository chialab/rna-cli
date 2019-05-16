const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const unset = require('postcss-all-unset');
const cssnano = require('cssnano');
const focusVisible = require('postcss-focus-visible');
const focusWithin = require('postcss-focus-within');
const copy = require('./plugins/postcss-copy/postcss-copy.js');
const postcssImport = require('postcss-import');
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
        let { input, output, code, root } = options;
        if (!input && !code) {
            throw `missing "input" or "code" option for ${this.name}`;
        }

        if (code && !root) {
            throw `missing "root" option for ${this.name} when using "code"`;
        }

        await super.setup(Object.assign({ lint: true }, options));

        const plugins = options.plugins || [];

        plugins.push(
            sass({
                omitSourceMapUrl: true,
                sourceMapContents: true,
                sourceMapEmbed: false,
                sourceMap: !options.map,
            }),
            postcssImport(),
            copy({
                basePath: (root && root.path) || input.dirname,
                dest: output && (output.extname ? output.dirname : output.path),
                handleCSSAsset: options.handleCSSAsset,
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

        if (this.options.get('production')) {
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

        if (this.options.get('lint')) {
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
    async build(...invalidate) {
        await super.build(...invalidate);

        let logger = this.getLogger();
        let input = this.options.get('input');
        let output = this.options.get('output');
        let code = this.options.get('code');
        let root = this.options.get('root');
        let map = this.options.get('map');
        let progress = this.options.get('progress');

        try {
            if (progress) {
                logger.play('generating styles...', input ? input.localPath : '');
            }

            if (input && !input.exists()) {
                throw `missing "input" file ${input.localPath} for ${this.name}`;
            }

            if (input) {
                this.addResources(input.path);
            }

            if (output && output.exists() && output.isFile() && output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let data = code || input.read();
            let config = {
                from: (input && input.path) || root.file('a.css').path,
                to: output && (output.extname ? output.path : output.file('style.css').path),
                syntax: this.options.get('syntax'),
                parser: this.options.get('parser'),
                map: map !== false ? {
                    inline: map === 'inline',
                    sourcesContent: true,
                } : false,
            };

            this.result = await postcss(this.options.get('plugins') || []).process(data, config);
            this.result.code = this.result.css.toString();
            this.addResources(...(this.result.dependencies || []));

            if (progress) {
                logger.stop();
            }

            if (this.linter && (this.linter.hasErrors() || this.linter.hasWarnings())) {
                logger.log(this.linter.report());
            }

            if (progress) {
                logger.success('css ready');
            }

            return this.result;
        } catch (error) {
            if (progress) {
                logger.stop();
            }
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        let progress = this.options.get('progress');
        let output = this.options.get('output');
        let map = this.options.get('map');
        let content = this.result.code;
        let externalMapFile = map !== false && map !== 'inline' && this.result.map;
        if (externalMapFile) {
            content += `\n/*# sourceMappingURL=${output.name}.map */`;
            output.mapFile.write(this.result.map);
        }
        output.write(content);
        if (progress) {
            let logger = this.getLogger();
            let { size, zipped } = output.size;
            logger.info(output.localPath, `${size}, ${zipped} zipped`);
        }
    }

    get linter() {
        if (!this.result) {
            return null;
        }

        return this.result.linter;
    }
}

module.exports = StyleBundler;
