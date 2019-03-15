const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const unset = require('postcss-all-unset');
const cssnano = require('cssnano');
const focusVisible = require('postcss-focus-visible');
const focusWithin = require('postcss-focus-within');
const copy = require('postcss-copy');
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

        await super.setup(options);

        if (code) {
            let tmpName = `${root.basename}-${Date.now()}-${Math.floor(Math.random() * 1000)}.css`;
            input = root.file(tmpName);
            output = output.file(tmpName);

            this.options.set('input', input);
            this.options.set('output', output);
        }

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
                basePath: [input.dirname],
                dest: output.dirname,
                preservePath: true,
                template: '[path]/[name].[ext]',
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
    async build(...invalidate) {
        await super.build(...invalidate);

        let profile = this.getProfiler();
        let logger = this.getLogger();
        let input = this.options.get('input');
        let output = this.options.get('output');
        let code = this.options.get('code');
        let map = this.options.get('map');

        try {
            logger.play(`generating ${code ? 'inline ' : ''}styles...`, input ? input.localPath : '');

            if (code) {
                input.write(code);
            }

            if (input && !input.exists()) {
                throw `missing "input" file ${input.localPath} for ${this.name}`;
            }

            profile.start();

            if (input) {
                this.addResources(input.path);
            }


            if (output && output.exists() && output.isFile() && output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let data = code || input.read();
            let config = {
                from: input.path,
                to: output.path,
                syntax: this.options.get('syntax'),
                parser: this.options.get('parser'),
                map: map !== false ? {
                    inline: map === 'inline',
                    sourcesContent: true,
                } : false,
            };

            this.result = await postcss(this.options.get('plugins') || []).process(data, config);
            this.addResources(...(this.result.dependencies || []));

            let externalMapFile = map !== false && map !== 'inline' && this.result.map;
            let content = this.result.css.toString();
            if (externalMapFile) {
                content += `\n/*# sourceMappingURL=${output.basename}.map */`;
                output.mapFile.write(this.result.map);
            }

            output.write(content);

            logger.stop();
            profile.end();

            if (this.linter && (this.linter.hasErrors() || this.linter.hasWarnings())) {
                logger.log(this.linter.report());
            }

            let { size, zipped } = output.size;
            logger.info(code ? 'generated' : output.localPath, `${size}, ${zipped} zipped`);

            if (code) {
                if (input.exists()) {
                    input.unlink();
                }
                if (output.exists()) {
                    output.unlink();
                }
            }

            logger.success(`${code ? 'inline ' : ''}css ready`);

            return this.result;
        } catch (error) {
            if (code) {
                if (input.exists()) {
                    input.unlink();
                }
                if (output.exists()) {
                    output.unlink();
                }
            }
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
