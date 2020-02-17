const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const unset = require('postcss-all-unset');
const cssnano = require('cssnano');
const variables = require('postcss-custom-properties');
const focusVisible = require('postcss-focus-visible');
const focusWithin = require('postcss-focus-within');
const copy = require('./plugins/postcss-copy/postcss-copy');
const postcssImport = require('postcss-import');
const { File, Directory, Project } = require('../File');
const Bundler = require('./Bundler');
const Targets = require('../Targets');
const stylelintPlugin = require('./plugins/postcss-stylelint-plugin/postcss-stylelint-plugin');
const sass = require('./plugins/postcss-dart-sass/postcss-dart-sass');
const sassSyntax = require('postcss-scss');

class StyleBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        options = Object.assign({
            lint: true,
            syntax: sassSyntax,
            parser: sassSyntax,
        }, options);

        let { input, output, code, root } = options;

        if (!input && !code) {
            throw new Error(`missing "input" or "code" option for ${this.name}`);
        }

        if (code && !root) {
            throw new Error(`missing "root" option for ${this.name} when using "code"`);
        }

        if (typeof input === 'string') {
            options.input = input = new File(input);
        }
        if (typeof output === 'string') {
            if (path.extname(options.output)) {
                options.output = output = new File(output);
            } else {
                options.output = output = new Directory(output);
            }
        }
        if (typeof root === 'string') {
            options.root = root = new Directory(root);
        } else if (!root) {
            options.root = root = Project.getProject(input);
        }

        await super.setup(options);

        const plugins = options.plugins || [];
        const targets = Targets.parse(options.targets);

        plugins.push(
            sass({
                omitSourceMapUrl: true,
                sourceMapContents: true,
                sourceMapEmbed: false,
            }),
            postcssImport(),
            copy({
                basePath: (root && root.path) || input.dirname,
                dest: output && (output.extname ? output.dirname : output.path),
                handler: options.handleAssets,
            }),
            autoprefixer({
                overrideBrowserslist: targets.toQuery(),
                grid: true,
                flexbox: true,
                remove: false,
            }),
            variables({
                preserve: true,
            }),
            unset(),
            focusVisible(),
            focusWithin({
                replaceWith: '.focus-within',
            }),
        );

        if (this.options.production) {
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

        if (this.options.lint) {
            plugins.push(
                stylelintPlugin({
                    root,
                }),
            );
        }

        this.options.plugins = plugins;
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        const { input, output, code, root, map } = this.options;

        this.emit(StyleBundler.BUNDLE_START, input, code);
        this.emit(StyleBundler.BUILD_START, input, code);

        try {
            if (!code && input && !input.exists()) {
                throw new Error(`missing "input" file ${root.relative(input)} for ${this.name}`);
            }

            if (!code && input) {
                this.addResources(input.path);
            }

            const data = code || input.read();
            const config = {
                from: (input && input.path) || root.file('a.css').path,
                to: output && (output.extname ? output.path : output.file('style.css').path),
                syntax: this.options.syntax,
                parser: this.options.parser,
                map: map !== false ? {
                    inline: map === 'inline',
                    sourcesContent: true,
                } : false,
            };

            this.result = await postcss(this.options.plugins || []).process(data, config);
            this.result.code = this.result.css.toString();

            const dependencies = this.result.messages
                .filter(({ type }) => type === 'dependency')
                .filter(({ file }) => fs.existsSync(file))
                .map(({ file }) => fs.realpathSync(file));
            this.addResources(...dependencies);

            if (this.result.linter) {
                const stylelinter = this.result.linter;
                this.linter.merge(stylelinter.result);
                if (this.linter.hasErrors() || this.linter.hasWarnings()) {
                    this.emit(StyleBundler.LINT_EVENT, this.linter.result);
                }
                stylelinter.reset();
            }

            this.emit(StyleBundler.BUILD_END, input, code);
            this.emit(StyleBundler.BUNDLE_END, this.result);

            return this.result;
        } catch (error) {
            this.emit(StyleBundler.ERROR_EVENT, error);
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        const { output, map } = this.options;
        if (!output || !output.extname) {
            return;
        }
        const externalMapFile = map !== false && map !== 'inline' && this.result.map;
        let content = this.result.code;

        this.emit(StyleBundler.WRITE_START);

        if (output && output.exists() && output.isFile() && output.mapFile.exists()) {
            output.mapFile.unlink();
        }

        if (externalMapFile) {
            content += `\n/*# sourceMappingURL=${output.name}.map */`;
            output.mapFile.write(this.result.map);
        }
        output.write(content);
        this.emit(StyleBundler.WRITE_PROGRESS, output);
        if (this.result.files) {
            this.result.files
                .map((fileName) => output.parent.file(fileName))
                .forEach((file) => {
                    this.emit(StyleBundler.WRITE_PROGRESS, file);
                });
        }

        this.emit(StyleBundler.WRITE_END);
        await super.write();
        return output;
    }
}

module.exports = StyleBundler;
