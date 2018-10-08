const fs = require('fs-extra');
const path = require('path');
const rollup = require('rollup');
const colors = require('colors/safe');
const resolve = require('resolve');
const utils = require('../utils');
const ESLint = require('../Linters/ESLint');
const PostCSS = require('./PostCSS');

const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const babel = require('./plugins/rollup-plugin-babel/rollup-plugin-babel');
const postcss = require('./plugins/rollup-plugin-postcss/rollup-plugin-postcss');
const nodeResolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const json = require('rollup-plugin-json');
const url = require('rollup-plugin-url');
const string = require('./plugins/rollup-plugin-string/rollup-plugin-string');
const optimize = require('rollup-plugin-optimize-js');
const typescript = require('rollup-plugin-typescript2');

function getBabelConfig(project, options) {
    const localConf = project.file('.babelrc');
    if (localConf.exists()) {
        return localConf.readJson();
    }

    return {
        include: /\.(mjs|js|jsx|ts)$/,
        babelrc: false,
        compact: false,
        presets: [
            [require('@chialab/babel-preset'), {
                targets: {
                    browsers: options.targets,
                },
                useBuiltIns: options.polyfill ? 'usage' : 'entry',
                modules: false,
                coverage: options.coverage,
                pragma: options['jsx.pragma'] || 'IDOM.h',
                pragmaModule: options['jsx.module'] || '@dnajs/idom',
                transformCommonjs: true,
            }],
        ],
        plugins: [
            require('@babel/plugin-syntax-dynamic-import').default,
        ],
    };
}

function getConfig(app, project, options) {
    const babelConfig = getBabelConfig(project, options);
    const eslintConfigFile = ESLint.detectConfigFile(app, project);
    const postCSSConfig = PostCSS.detectConfig(app, project, options);

    return {
        input: options.input,
        output: {
            file: options.output,
            name: options.name || utils.camelize(
                path.basename(options.output, path.extname(options.output))
            ),
            format: options.format || 'umd',
            sourcemap: (typeof options.map === 'string') ? options.map : (options.map !== false),
            strict: false,
            indent: false,
        },
        plugins: [
            options.lint !== false ? eslint({
                include: /\.(mjs|js|jsx|ts)$/,
                options: {
                    configFile: eslintConfigFile,
                    cwd: project.path,
                },
            }) : {},
            /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
            nodeResolve({
                module: true,
                jsnext: true,
                main: true,
                preserveSymlinks: true,
            }),
            json(),
            string({
                include: [
                    /\.(html|txt|svg|md)$/,
                ],
            }),
            url({
                limit: 0,
                exclude: [],
                include: [
                    /\.(woff|ttf|eot|gif|png|jpg)$/,
                ],
            }),
            postcss({
                exclude: [],
                include: [
                    /\.(css|scss|sass)$/,
                ],
                options: postCSSConfig,
            }),

            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            path.extname(options.input) === '.ts' ? typescript({
                include: [/\.(ts|tsx)$/],
                clean: true,
                cacheRoot: options.cacheRoot,
                useTsconfigDeclarationDir: true,
                tsconfigOverride: {
                    compilerOptions: {
                        declaration: !!options.declaration,
                    },
                },
            }) : {},
            babel(babelConfig),
            options.production ? terser({
                comments(node, { type, text }) {
                    if (type == 'comment2') {
                        // multiline comment
                        return /@preserve|@license|@cc_on/i.test(text);
                    }
                },
            }) : {},
            options.optimize ? optimize() : {},
        ],
        onwarn(warning) {
            let message = warning && warning.message || warning;
            const whitelisted = () => {
                message = message.toString();
                if (message.indexOf('Using "external-helpers" plugin with rollup-plugin-babel is deprecated') !== -1) {
                    return false;
                }
                if (message.indexOf('The \'this\' keyword') !== -1) {
                    return false;
                }
                if (message.indexOf('It\'s strongly recommended that you use the "external-helpers" plugin') !== -1) {
                    return false;
                }
                if (message.indexOf('rollupPluginBabelHelper') !== -1) {
                    return false;
                }
                return true;
            };
            if (message && options.verbose || whitelisted()) {
                // eslint-disable-next-line
                console.log(colors.yellow(`⚠️  ${message}`));
            }
        },
        external(id) {
            try {
                if (id && resolve.isCore(id)) {
                    // core nodejs modules
                    return true;
                }
            } catch (err) {
                //
            }
            return false;
        },
        perf: true,
        preserveSymlinks: true,
    };
}

class Rollup {
    /**
     * Resolve the rollup configuration.
     *
     * @param {CLI} app The current app instance.
     * @param {Project} project The project to build.
     * @param {Object} options Default options.
     * @returns {Promise}
     */
    static detectConfig(app, project, options) {
        const configFile = project.file('rollup.config.js');

        if (!configFile.exists()) {
            return getConfig(app, project, options);
        }

        return require(configFile.path);
    }

    constructor(options = {}) {
        this.options = Object.assign({}, options);
    }

    async build() {
        let config = Object.assign({}, this.options);
        let previousResult = this.result;
        if (previousResult) {
            config.cache = previousResult.cache;
        }
        this.result = await rollup.rollup(config);
        delete config.cache;

        return this.result;
    }

    async write() {
        return await this.result.write(this.options.output);
    }

    get linter() {
        if (!this.result) {
            return null;
        }

        let plugin = this.options.plugins.find((p) => p.name === 'eslint');
        if (!plugin) {
            return null;
        }
        return plugin.linter;
    }

    get files() {
        return [
            this.input,
            // get bundle dependencies
            ...this.result.modules
                .reduce((dependencies, mod) => {
                    dependencies.push(
                        ...(mod.dependencies || [])
                            // filter files
                            .filter((p) => fs.existsSync(p))
                            // map to real files
                            .map((p) => fs.realpathSync(p))
                    );

                    return dependencies;
                }, []),
        ];
    }

    get timings() {
        let timings = this.result.getTimings();
        let tasks = {
            treeshaking: 0,
            sourcemaps: 0,
            parsing: 0,
        };
        Object.keys(timings).forEach((key) => {
            if (key.match(/treeshaking/)) {
                tasks.treeshaking += timings[key][0];
            } else if (key.match(/sourcemap/)) {
                tasks.sourcemaps += timings[key][0];
            } else if (key.match(/generate ast/)) {
                tasks.parsing += timings[key][0];
            } else if (key.match(/plugin/)) {
                let match = key.match(/plugin\s*(\d*)(?:\s*\(([\w-_]*)\))?/i);
                let name = match[2] || match[1];
                tasks[name] = tasks[name] || 0;
                tasks[name] += timings[key][0];
            }
        });
        return tasks;
    }
}

module.exports = Rollup;
