const { existsSync, realpathSync } = require('fs');
const path = require('path');
const resolve = require('resolve');
const { rollup } = require('rollup');
const { createPrinter } = require('typescript');
const { bundle } = require('dts-apigen');
const colors = require('colors/safe');
const { File, Directory, Project } = require('../File');
const Bundler = require('./Bundler');
const Targets = require('../Targets');

const nodeResolve = require('@rollup/plugin-node-resolve');
const sourcemaps = require('rollup-plugin-sourcemaps');
const json = require('@rollup/plugin-json');
const typescript = require('@rollup/plugin-typescript');
const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const babel = require('./plugins/rollup-plugin-babel/rollup-plugin-babel');
const postcss = require('./plugins/rollup-plugin-postcss/rollup-plugin-postcss');
const terser = require('./plugins/rollup-plugin-terser/rollup-plugin-terser');
const sw = require('./plugins/rollup-plugin-sw/rollup-plugin-sw');
const worker = require('./plugins/rollup-plugin-worker/rollup-plugin-worker');
const html = require('./plugins/rollup-plugin-html/rollup-plugin-html');
const url = require('./plugins/rollup-plugin-url/rollup-plugin-url');
const string = require('./plugins/rollup-plugin-string/rollup-plugin-string');
const po = require('./plugins/rollup-plugin-po/rollup-plugin-po');
const analyze = require('./plugins/rollup-plugin-analyzer/rollup-plugin-analyzer');
const polyfill = require('./plugins/rollup-plugin-polyfill/rollup-plugin-polyfill');
const dependencyCheck = require('./plugins/rollup-plugin-dependency-check/rollup-plugin-dependency-check');

/**
 * Convert a file path to CamelCase.
 *
 * @param {string} file The file path.
 * @returns {string}
 */
function camelize(file) {
    let filename = path.basename(file, path.extname(file));
    return filename.replace(/(^[a-z0-9]|[-_]([a-z0-9]))/g, (g) => (g[1] || g[0]).toUpperCase());
}

function formatBytes(bytes) {
    if (bytes <= 0 || isNaN(bytes)) {
        return '0 B ';
    }
    const sizes = ['B ', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/* eslint-disable no-unused-vars */
function printTimings(app, timings) {
    Object.keys(timings).forEach(label => {
        const color = label[0] === '#' ? (label[1] !== '#' ? colors.underline : colors.bold) : (text) => text;
        const [time, memory, total] = timings[label];
        const row = `${label}: ${time.toFixed(0)}ms, ${formatBytes(memory)} / ${formatBytes(total)}`;
        // eslint-disable-next-line
        console.info(color(row));
    });
}
/* eslint-enavke no-unused-vars */

const DEPENDENCIES_CACHE = {
    esm: {},
    cjs: {},
    umd: {},
    system: {},
};

function createCache(format) {
    return {
        plugins: {},
        modules: Object.values(DEPENDENCIES_CACHE[format]),
    };
}

function cacheDependencies(format, cache) {
    if (cache.modules) {
        cache.modules
            .filter(({ id }) => id.indexOf('/node_modules/') !== -1)
            .forEach((mod) => {
                DEPENDENCIES_CACHE[format][mod.id] = mod;
            });
    }
}

class ScriptBundler extends Bundler {
    /**
     * Formatter for bundle analysis.
     * @param {Array} analysis Analysis data.
     * @return {string}
     */
    static formatBundleAnalysis(analysis) {
        const lengths = analysis.modules.map((m) => m.id.length);
        const maxLength = Math.max(...lengths) + 1;
        const lines = [];

        analysis.modules.forEach((m) => {
            const size = formatBytes(m.size);
            lines.push(`${m.id.padEnd(maxLength, ' ')} ${m.reduction == 100 ? colors.red('removed by threeshake') : `${m.percent.toFixed(2).padStart(5, ' ')}% | ${colors.yellow(size.padStart(9, ' '))}${m.reduction > 0 ? colors.green(` (-${m.reduction}%)`) : ''}`}`);
        });

        return `\n${lines.join('\n')}\n`;
    }

    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        options = Object.assign({}, options);

        let { input, output, code, root, format, coverage, jsx, assertions } = options;
        if (!input && !code) {
            throw new Error(`missing "input" or "code" option for ${this.name}`);
        }

        if (code && !root) {
            throw new Error(`missing "root" option for ${this.name} when using "code"`);
        }

        if (typeof input === 'string') {
            options.input = input = new File(input);
        } else if (code && !input) {
            let tmpName = `${root.basename}-${Date.now()}-${Math.floor(Math.random() * 1000)}.js`;
            options.input = input = root.file(tmpName);
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

        const tsconfig = Project.getTSConfig(input);
        const targets = Targets.parse(options.targets);
        const project = (input && Project.getProject(input)) || root || new Project(process.cwd());
        const cjsCache = new Map();
        const babelConfig = {
            include: /\.(mjs|js|jsx|ts|tsx)$/,
            babelrc: false,
            compact: false,
            inputSourceMap: !!coverage,
            presets: [
                [require('@babel/preset-env'), {
                    targets: format === 'esm' ?
                        { esmodules: true } :
                        targets.toObject(),
                    corejs: {
                        version: 3,
                        proposals: true,
                    },
                    bugfixes: true,
                    shippedProposals: true,
                    useBuiltIns: 'entry',
                    modules: false,
                    exclude: [
                        '@babel/plugin-transform-typeof-symbol',
                    ],
                }],
            ],
            plugins: [
                require('@babel/plugin-syntax-dynamic-import'),
                require('@babel/plugin-syntax-import-meta'),
                require('@babel/plugin-transform-flow-strip-types'),
                [require('@babel/plugin-transform-typescript'), {
                    isTSX: true,
                }],
                require('./plugins/babel-plugin-transform-typeof-symbol/babel-plugin-transform-typeof-symbol'),
                [require('@babel/plugin-transform-runtime'), {
                    absoluteRuntime: require.resolve('@babel/runtime/package.json').replace(/(\/|\\)package\.json/, ''),
                    corejs: false,
                    helpers: true,
                    regenerator: true,
                    useESModules: true,
                }],
                [require('@babel/plugin-proposal-decorators'), {
                    decoratorsBeforeExport: true,
                }],
                require('@babel/plugin-proposal-class-properties'),
                require('@babel/plugin-proposal-private-methods'),
                require('@babel/plugin-proposal-nullish-coalescing-operator'),
                require('@babel/plugin-proposal-optional-chaining'),
                require('babel-plugin-transform-inline-environment-variables'),
                jsx !== false && require('./plugins/babel-plugin-jsx-template/babel-plugin-jsx-template'),
                jsx !== false && [require('babel-plugin-htm'), {
                    pragma: options.jsx && options.jsx.pragma || 'IDOM.h',
                    import: {
                        module: options.jsx && options.jsx.module || '@dnajs/idom',
                        export: (options.jsx && !!options.jsx.pragmaDefault) ? 'default' : undefined,
                    },
                }],
                jsx !== false && [require('./plugins/babel-plugin-jsx/babel-plugin-jsx'), {
                    pragma: options.jsx && options.jsx.pragma || 'IDOM.h',
                    pragmaFrag: options.jsx && options.jsx.pragmaFrag,
                    import: options.jsx && options.jsx.module || '@dnajs/idom',
                    pragmaDefault: options.jsx && !!options.jsx.pragmaDefault,
                }],
                (format === 'umd' || format === 'iife') ?
                    require('./plugins/babel-plugin-dynamic-to-static/babel-plugin-dynamic-to-static') :
                    require('./plugins/babel-plugin-webpack-import/babel-plugin-webpack-import'),
                assertions && require('./plugins/babel-plugin-assertions/babel-plugin-assertions'),
                coverage && [require('babel-plugin-istanbul'), {
                    include: [],
                    exclude: [
                        '**/test/**',
                        '**/node_modules/**',
                    ],
                    useInlineSourceMaps: true,
                }],
                [require('./plugins/babel-plugin-transform-commonjs/babel-plugin-transform-commonjs'), {
                    cache: cjsCache,
                }],
            ].filter(Boolean),
        };

        const plugins = [
            {
                resolveId(id) {
                    if (!code) {
                        return;
                    }
                    if (id === input.path) {
                        return id;
                    }
                },

                load(id) {
                    if (!code) {
                        return;
                    }
                    if (id === input.path) {
                        return code;
                    }
                },

                renderChunk(code, chunk) {
                    if (chunk.facadeModuleId === input.path) {
                        if (output && output.extname) {
                            chunk.fileName = output.name;
                        }
                    }
                },
            },
            dependencyCheck(project, {
                exclude: [
                    'core-js',
                    'chai',
                ],
            }),
            options.analyze ? analyze({
                root: root.path,
                onAnalysis: (result) => {
                    this.emit(ScriptBundler.ANALYSIS_EVENT, result);
                },
                onError: (error) => {
                    // eslint-disable-next-line
                    console.error(error);
                },
            }) : {},
            options.lint ? eslint({
                include: [
                    path.join(project.path, '**/*.{mjs,js,jsx,ts,tsx}'),
                ],
                project,
            }) : {},
            /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
            polyfill(),
            nodeResolve({
                mainFields: ['module', 'jsnext', 'jsnext:main', 'main'],
                extensions: [`.${format}.js`, `.${format}.jsx`, `.${format}.ts`, `.${format}.tsx`, '.mjs', '.js', '.ts', '.tsx', '.json', '.node'],
                preserveSymlinks: true,
            }),
            po(),
            json({
                include: [
                    /\.json$/,
                    /\.geojson$/,
                ],
            }),
            string({
                include: [
                    /\.(txt|md)$/,
                ],
            }),
            url({
                exclude: [
                    /\.(mjs|js|jsx|ts|tsx|po|json|geojson|txt|md|html|htm|css|scss|sass)$/,
                ],
                include: [],
            }),
            html({
                format,
                targets: options.targets,
                exclude: [],
                include: [
                    /\.(html|htm)$/,
                ],
            }),
            postcss({
                exclude: [],
                include: [
                    /\.(css|scss|sass)$/,
                ],
                root: root || input.parent,
                output: output && output.extname ? output.parent : output,
                targets: options.targets,
            }),
            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            (tsconfig && !coverage) ? typescript({
                include: [/\.(ts|tsx)$/],
                jsx: 'preserve',
                tsconfig: tsconfig.path,
            }) : {},
            babel(babelConfig),
            sourcemaps(),
            worker(),
            /** FINALIZERS */
            options.sw ? sw(options.sw) : {},
            options.production ? terser({
                mangle: {
                    eval: false,
                    keep_classnames: true,
                    safari10: true,
                },
                module: true,
                toplevel: true,
                sourceMap: options.map !== false,
                output: {
                    comments: /@preserve|@license|@cc_on|[@#]__PURE__/i,
                    preserve_annotations: true,
                },
            }) : {},
        ];

        options.format = options.format || 'umd';
        options.plugins = plugins;
        options.external = (id) => {
            if (id.match(/^https?:\/\//)) {
                return true;
            }

            const { format, bundle } = this.options;
            if (!bundle && format !== 'umd' && format !== 'iife' && !path.isAbsolute(id) && !id.match(/\.\.?\//)) {
                // do not include node modules
                return true;
            }

            try {
                if (id && resolve.isCore(id)) {
                    // core nodejs modules
                    return true;
                }
            } catch (err) {
                //
            }
            return false;
        };

        await super.setup(options);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        const { input, output, root, code, map, typings, format, cache, vendors } = this.options;

        this.emit(ScriptBundler.BUNDLE_START, input, code);
        this.emit(ScriptBundler.BUILD_START, input, code);

        try {
            if (!code && input && !input.exists()) {
                throw new Error(`missing "input" file ${root.relative(input)} for ${this.name}`);
            }

            const oldFiles = this.result && this.result.outputFiles || [];
            const config = {
                input: input.path,
                cache: (this.result && this.result.cache) || (cache !== false && createCache(format)),
                plugins: this.options.plugins || [],
                external: this.options.external,
                inlineDynamicImports: format === 'umd' || format === 'iife' || !!this.options.sw,
                preserveSymlinks: true,
                onwarn: (warning) => {
                    let message = warning && warning.message || warning;
                    message = message.toString();
                    if (message.indexOf('The \'this\' keyword') !== -1) {
                        return false;
                    }
                    if (message.indexOf('rollupPluginBabelHelper') !== -1) {
                        return false;
                    }
                    this.emit(ScriptBundler.WARN_EVENT, message);
                },
                // perf: true,
            };

            if (vendors) {
                config.manualChunks = function(id) {
                    if (id.includes('node_modules') && id.match(/\.(js|jsx|mjs|ts|tsx)$/)) {
                        return 'vendor';
                    }
                };
            }

            const configOutput = config.output = {
                name: format !== 'system' && (this.options.name || camelize(output ? output.path : input.path)),
                format,
                sourcemap: (typeof map === 'string') ? map : (map !== false),
                strict: false,
                indent: false,
                assetFileNames: '[name][extname]',
                minifyInternalExports: true,
            };

            if (output && output.extname) {
                configOutput.dir = output.parent.path;
            } else if (output && !output.extname) {
                configOutput.dir = output.path;
            }

            this.config = config;
            this.result = await rollup(config);
            this.result.outputFiles = oldFiles;
            this.addResources(...this.result.watchFiles
                .filter((filePath) => existsSync(filePath))
                .map((fileName) => realpathSync(fileName))
            );

            const { output: files } = await this.result.generate(configOutput);
            this.result.code = files[0].code;
            if (typings) {
                const typingsFile = output.parent.file(`${output.basename}.d.ts`);
                if (!typingsFile) {
                    this.emit(ScriptBundler.WARN_EVENT, 'missing output path for typings. Add the `types` field in your package.json. Read more here https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html');
                } else {
                    const sourceFile = bundle(input.path);
                    const code = createPrinter().printFile(sourceFile);
                    typingsFile.write(code);
                }
            }

            if (this.result.cache && cache !== false) {
                cacheDependencies(format, this.result.cache);
            }

            const plugins = this.options.plugins || [];
            const plugin = plugins.find((p) => p.name === 'eslint');
            if (plugin) {
                const eslinter = plugin.linter;
                this.linter.merge(eslinter.result);
                if (this.linter.hasErrors() || this.linter.hasWarnings()) {
                    this.emit(ScriptBundler.LINT_EVENT, this.linter.result);
                }
                eslinter.reset();
            }

            this.emit(ScriptBundler.BUILD_END, input, code);
            this.emit(ScriptBundler.BUNDLE_END, this.result);

            // if (this.result && this.result.getTimings) {
            //     printTimings(this.app, this.result.getTimings());
            // }

            return this.result;
        } catch (error) {
            this.emit(ScriptBundler.ERROR_EVENT, error);
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        const output = this.options.output;
        if (!output) {
            return;
        }

        this.emit(ScriptBundler.WRITE_START);

        const oldFiles = this.result.outputFiles || [];
        const outputResult = await this.result.write(this.config.output);
        this.result.outputFiles = outputResult.output
            .filter((out) => out.fileName)
            .map((out) => {
                if (output.extname) {
                    return output.parent.file(out.fileName);
                }
                return output.file(out.fileName);
            });

        oldFiles
            .filter((file) => !this.result.outputFiles.some((outFile) => outFile.path === file.path))
            .forEach((file) => {
                if (file.mapFile && file.mapFile.exists()) {
                    file.mapFile.unlink();
                }
                file.unlink();
            });

        this.result.outputFiles.forEach((file) => {
            this.emit(ScriptBundler.WRITE_PROGRESS, file);
        });

        this.emit(ScriptBundler.WRITE_END);
        await super.write();
        return outputResult;
    }
}

module.exports = ScriptBundler;
