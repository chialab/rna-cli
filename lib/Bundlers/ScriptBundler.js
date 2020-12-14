const path = require('path');
const resolve = require('resolve');
const { rollup } = require('rollup');
const colors = require('colors/safe');
const { prettyBytes, File, Directory, Project } = require('../File');
const Bundler = require('./Bundler');
const Targets = require('../Targets');

const commonjs = require('@rollup/plugin-commonjs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const json = require('@rollup/plugin-json');
const sourcemaps = require('rollup-plugin-sourcemaps');
const analyze = require('rollup-plugin-analyzer');
const tsx = require('./plugins/rollup-plugin-tsx/rollup-plugin-tsx');
const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const postcss = require('./plugins/rollup-plugin-postcss/rollup-plugin-postcss');
const sw = require('./plugins/rollup-plugin-sw/rollup-plugin-sw');
const worker = require('./plugins/rollup-plugin-worker/rollup-plugin-worker');
const html = require('./plugins/rollup-plugin-html/rollup-plugin-html');
const url = require('./plugins/rollup-plugin-url/rollup-plugin-url');
const string = require('./plugins/rollup-plugin-string/rollup-plugin-string');
const po = require('./plugins/rollup-plugin-po/rollup-plugin-po');
const polyfill = require('./plugins/rollup-plugin-polyfill/rollup-plugin-polyfill');

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

/* eslint-disable no-unused-vars */
function printTimings(app, timings) {
    Object.keys(timings).forEach(label => {
        const color = label[0] === '#' ? (label[1] !== '#' ? colors.underline : colors.bold) : (text) => text;
        const [time, memory, total] = timings[label];
        const row = `${label}: ${time.toFixed(0)}ms, ${prettyBytes(memory)} / ${prettyBytes(total)}`;
        // eslint-disable-next-line
        console.info(color(row));
    });
}
/* eslint-enable no-unused-vars */

class ScriptBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        options = Object.assign({}, options);

        let { input, output, map, code, root, format, coverage, jsx, production, bundle } = options;
        let iife = (format === 'umd' || format === 'iife');
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
            options.root = root = await Project.getProject(input);
        }

        let project = (input && await Project.getProject(input)) || root || await Project.init(process.cwd());
        let dependencies = [
            ...Object.keys(project.get('dependencies') || {}),
            ...Object.keys(project.get('peerDependencies') || {}),
            ...Object.keys(project.get('devDependencies') || {}),
        ];

        await super.setup({
            ...options,
            format: options.format || 'esm',
            plugins: [
                {
                    resolveId(importee, importer) {
                        if (importee.match(/^https?:\/\//)) {
                            return { id: importee, external: true };
                        }

                        try {
                            if (resolve.isCore(importee)) {
                                if (!bundle && format === 'cjs') {
                                    return { id: importee, external: true };
                                }

                                return importee;
                            }
                        } catch(err) {
                            //
                        }

                        if (!bundle && !iife && !path.isAbsolute(importee) && !importee.match(/\.\.?\//)) {
                            // do not include node modules
                            return { id: importee, external: true };
                        }

                        if (code && importee === input.path) {
                            return importee;
                        }

                        if (!importer) {
                            return null;
                        }

                        if (importee.indexOf('./') === 0 || importee.indexOf('../') === 0) {
                            return null;
                        }

                        if (importer.indexOf('/node_modules/') !== -1) {
                            return null;
                        }

                        if (importee.indexOf('@babel/runtime') !== -1 || importee.indexOf('core-js') !== -1) {
                            return null;
                        }

                        if (importee.indexOf('\0') === 0) {
                            return null;
                        }

                        let split = importee.split('/');
                        let moduleName = split[0];
                        if (!moduleName) {
                            return null;
                        }

                        if (importee[0] === '@') {
                            moduleName += `/${split[1]}`;
                        }

                        if (dependencies.indexOf(moduleName) === -1) {
                            let warning = `dependency '${moduleName}' is not listed in ${project.packageJson.path}`;
                            let warnings = this.warnings = this.warnings || [];
                            if (warnings.indexOf(warning) === -1) {
                                warnings.push(warning);
                                this.warn({
                                    message: warning,
                                });
                            }
                        }

                        return null;
                    },

                    load(id) {
                        if (code && id === input.path) {
                            return code;
                        }

                        try {
                            if (id && format !== 'cjs' && resolve.isCore(id)) {
                                // core nodejs modules
                                return 'export default {}';
                            }
                        } catch (err) {
                            //
                        }
                    },

                    transform: (code, id) => {
                        if (id.indexOf('@babel/runtime') !== -1 || id.indexOf('core-js') !== -1) {
                            return;
                        }
                        if (id.indexOf('?') !== -1) {
                            return;
                        }
                        this.emit(ScriptBundler.BUILD_PROGRESS_EVENT, new File(id));
                    },

                    renderChunk(code, chunk) {
                        if (chunk.facadeModuleId === input.path) {
                            if (output && output.extname) {
                                chunk.fileName = output.name;
                            }
                        }
                    },
                },
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
                /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
                tsx({
                    include: /\.(mjs|js|jsx|ts|tsx)$/,
                    format,
                    production,
                    sourcemap: (typeof map === 'string') ? map : (map !== false),
                    targets: Targets.parse(options.targets).toObject(),
                    coverage,
                    pragma: jsx && jsx.pragma,
                    pragmaFrag: jsx && jsx.pragmaFrag,
                    pragmaDefault: jsx && jsx.pragmaDefault,
                    pragmaImport: jsx && jsx.module,
                }),
                worker(),
                /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
                polyfill(),
                nodeResolve.default({
                    mainFields: ['exports', 'module', 'jsnext', 'jsnext:main', 'main'],
                    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json', '.node'],
                }),
                commonjs(),
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
                sourcemaps(),
                /** FINALIZERS */
                options.sw ? sw(options.sw) : {},
            ],
        });
    }

    /**
     * @inheritdoc
     */
    async build(invalidate) {
        await super.build(invalidate);

        let { input, output, root, code, map, production, format, plugins, vendors } = this.options;
        let inlineDynamicImports = (format === 'umd' || format === 'iife');

        this.emit(ScriptBundler.BUNDLE_START_EVENT, input, code);
        this.emit(ScriptBundler.BUILD_START_EVENT, input, code);

        try {
            if (!code && input && await input.isNew()) {
                throw new Error(`missing "input" file ${root.relative(input)} for ${this.name}`);
            }

            let oldFiles = this.result && this.result.outputFiles || [];
            let config = {
                input: input.path,
                treeshake: !!production,
                cache: this.result && this.result.cache,
                plugins,
                inlineDynamicImports: inlineDynamicImports || !!this.options.sw,
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
                    if (message.indexOf('is imported from external module') !== -1) {
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

            let configOutput = config.output = {
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

            await this.addResources(...this.result.watchFiles);

            let { output: files } = await this.result.generate(configOutput);
            this.result.code = files[0].code;

            // emit linter results
            let eslintPlugin = plugins.find((p) => p.name === 'eslint');
            if (eslintPlugin) {
                let eslinter = eslintPlugin.linter;
                this.linter.merge(eslinter.result);
                if (this.linter.hasErrors() || this.linter.hasWarnings()) {
                    this.emit(ScriptBundler.LINT_EVENT, this.linter.result);
                }
                eslinter.reset();
            }

            this.emit(ScriptBundler.BUILD_END_EVENT, input, code);
            this.emit(ScriptBundler.BUNDLE_END_EVENT, this.result);

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

        this.emit(ScriptBundler.WRITE_START_EVENT);

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

        await Promise.all(
            oldFiles
                .filter((file) => !this.result.outputFiles.some((outFile) => outFile.path === file.path))
                .map(async (file) => {
                    if (file.mapFile && await file.mapFile.exists()) {
                        await file.mapFile.unlink();
                    }

                    await file.unlink();
                })
        );

        this.result.outputFiles.forEach((file) => {
            this.emit(ScriptBundler.WRITE_PROGRESS_EVENT, file);
        });

        this.emit(ScriptBundler.WRITE_END_EVENT);
        await super.write();
        return outputResult;
    }
}

module.exports = ScriptBundler;
