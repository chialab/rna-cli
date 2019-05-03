const fs = require('fs-extra');
const path = require('path');
const resolve = require('resolve');
const { rollup } = require('rollup');
const { createPrinter } = require('typescript');
const { bundle } = require('dts-apigen');
const Bundler = require('./Bundler');
const ESLint = require('../Linters/ESLint');

const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const babel = require('./plugins/rollup-plugin-babel/rollup-plugin-babel');
const postcss = require('./plugins/rollup-plugin-postcss/rollup-plugin-postcss');
const nodeResolve = require('rollup-plugin-node-resolve');
const terser = require('./plugins/rollup-plugin-terser/rollup-plugin-terser');
const json = require('rollup-plugin-json');
const url = require('./plugins/rollup-plugin-url/rollup-plugin-url');
const string = require('./plugins/rollup-plugin-string/rollup-plugin-string');
const typescript = require('rollup-plugin-typescript2');
const po = require('./plugins/rollup-plugin-po/rollup-plugin-po');
const analyze = require('rollup-plugin-analyzer');
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

class ScriptBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        const configFile = this.project.file('rollup.config.js');
        if (configFile.exists()) {
            return await super.setup(require(configFile.path));
        }

        let { input, output, code, root } = options;
        if (!input && !code) {
            throw `missing "input" or "code" option for ${this.name}`;
        }

        if (code && !root) {
            throw `missing "root" option for ${this.name} when using "code"`;
        }

        await super.setup(options);

        if (code) {
            let tmpName = `${root.basename}-${Date.now()}-${Math.floor(Math.random() * 1000)}.js`;
            input = root.file(tmpName);
            this.options.set('input', input);
        }

        if (output && !output.extname && input) {
            output = output.file(input.basename.replace(input.extname, '.js'));
            this.options.set('output', output);
        }

        let localBabelConf = this.project.file('.babelrc');
        let babelConfig;
        if (localBabelConf.exists()) {
            babelConfig = localBabelConf.readJson();
        } else {
            let targets = options.targets;
            if (targets === 'esmodules') {
                targets = { esmodules: true };
            } else if (targets === 'node') {
                targets = { node: true };
            } else {
                targets = { browsers: targets };
            }

            babelConfig = {
                include: /\.(mjs|js|jsx|ts)$/,
                babelrc: false,
                compact: false,
                presets: [
                    [require('@chialab/babel-preset'), {
                        targets,
                        useBuiltIns: false,
                        modules: false,
                        coverage: options.coverage,
                        pragma: options['jsx.pragma'] || 'IDOM.h',
                        pragmaModule: options['jsx.module'] || '@dnajs/idom',
                        transformCommonjs: true,
                        asyncToPromises: true,
                    }],
                ],
                plugins: [
                    require('@babel/plugin-syntax-dynamic-import').default,
                ],
            };
        }

        let eslintConfig = ESLint.detectConfig(this.app, this.project);

        let projectPath = input.parent;
        let packageJsonFile;
        while (projectPath.path !== this.project.dirname) {
            packageJsonFile = projectPath.file('package.json');
            if (packageJsonFile.exists()) {
                break;
            }
            packageJsonFile = null;
            projectPath = projectPath.parent;
        }

        let projectDependencies = null;
        if (packageJsonFile) {
            projectDependencies = [
                ...Object.keys(packageJsonFile.readJson().dependencies || {}),
                ...Object.keys(packageJsonFile.readJson().peerDependencies || {}),
                ...Object.keys(packageJsonFile.readJson().devDependencies || {}),
            ];
        }

        let plugins = [
            code ? {
                resolveId(id) {
                    if (id === input.path) {
                        return `code:${id}`;
                    }
                },
                load(id) {
                    if (id.indexOf('code:') === 0) {
                        return code;
                    }
                },
            } : {},
            {
                resolveId(importee, importer) {
                    if (!importer) {
                        return null;
                    }
                    if (!projectDependencies) {
                        return;
                    }
                    if (importee.indexOf('./') === 0 || importee.indexOf('../') === 0) {
                        return;
                    }
                    if (importer.indexOf('/node_modules/') !== -1) {
                        return null;
                    } else if (importee.indexOf('\0') === 0) {
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
                    if (projectDependencies.indexOf(moduleName) === -1) {
                        let warning = `dependency "${moduleName}" is not listed in ${packageJsonFile.localPath}`;
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
            },
            options.analyze ? analyze.plugin({
                stdout: false,
                skipFormatted: true,
                onWrite() { },
                onAnalysis: (result) => {
                    let fileName = options.analyze;
                    if (typeof fileName === 'boolean') {
                        fileName = 'bundle-analyzer-report.json';
                    }
                    let file = this.project.file(fileName);
                    file.writeJson(result);
                },
            }) : {},
            options.lint !== false ? eslint({
                include: /\.(mjs|js|jsx|ts)$/,
                options: eslintConfig,
            }) : {},
            /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
            polyfill(),
            nodeResolve({
                mainFields: ['module', 'main', 'jsnext'],
                preserveSymlinks: true,
            }),
            po(),
            json(),
            string({
                include: [
                    /\.(html|txt|svg|md)$/,
                ],
            }),
            url({
                exclude: [],
                include: [
                    /\.(woff|ttf|eot|gif|png|jpg|m4v|mp4|webm|mp3|ogg|ogv|vtt)$/,
                ],
            }),
            postcss(this.app, this.project)({
                exclude: [],
                include: [
                    /\.(css|scss|sass)$/,
                ],
                root: root || input.parent,
                output: output.basename ? output.parent : output,
            }),

            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            this.project.file('tsconfig.json').exists() ? typescript({
                include: [/\.(ts|tsx)$/],
                clean: true,
                cacheRoot: options.cacheRoot || './.cache',
                abortOnError: true,
            }) : {},
            babel(babelConfig),
            /** FINALIZERS */
            options.production ? terser({
                sourceMap: options.map !== false,
                output: {
                    comments(node, { type, text }) {
                        if (type == 'comment2') {
                            // multiline comment
                            return /@preserve|@license|@cc_on/i.test(text);
                        }
                    },
                },
            }) : {},
        ];

        let external = (id) => {
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

        this.options.set('plugins', plugins);
        this.options.set('external', external);
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
        let typings = this.options.get('typings');
        let progress = this.options.get('progress');

        try {
            if (progress) {
                logger.play(`generating script${invalidate.length ? ' (this will be fast)...' : '...'}`, code ? '' : input.localPath);
            }

            if (!code && input && !input.exists()) {
                throw `missing "input" file ${input.localPath} for ${this.name}`;
            }

            profile.start();

            if (input && !code) {
                this.addResources(input.path);
            }

            if (output && output.exists() && output.isFile() && output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let config = {
                input: input.path,
                output: {
                    file: output.extname ? output.path : null,
                    dir: !output.extname ? output.path : null,
                    name: this.options.get('name') || camelize(output.path),
                    format: this.options.get('format') || 'umd',
                    sourcemap: (typeof map === 'string') ? map : (map !== false),
                    strict: false,
                    indent: false,
                    assetFileNames: this.options.get('assetFileNames') || 'assets/[name][extname]',
                },
                cache: this.result && this.result.cache,
                plugins: this.options.get('plugins') || [],
                external: this.options.get('external'),
                perf: true,
                preserveSymlinks: true,
                onwarn: (warning) => {
                    if (warning.code === 'UNRESOLVED_IMPORT') {
                        throw warning;
                    }
                    let message = warning && warning.message || warning;
                    message = message.toString();
                    if (message.indexOf('The \'this\' keyword') !== -1) {
                        return false;
                    }
                    if (message.indexOf('rollupPluginBabelHelper') !== -1) {
                        return false;
                    }
                    logger.warn(message);
                },
            };
            this.config = config;
            this.result = await rollup(config);
            this.addResources(...this.result.watchFiles.filter((filePath) => fs.existsSync(filePath)));

            let { output: files } = await this.result.generate(config.output);
            this.result.code = files[0].code;
            if (typings) {
                let typingsFile = typings === true ? output.directory.file(output.basename.replace(output.extname, '.d.ts')) : typings;
                if (!typingsFile) {
                    logger.warn('Missing output path for typings. Add the `types` field in your package.json. Read more here https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html')
                } else {
                    let sourceFile = bundle(input.path);
                    let code = createPrinter().printFile(sourceFile);
                    typingsFile.write(code);
                }
            }

            if (this.options.get('profile')) {
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
                for (let k in tasks) {
                    profile.task(k, false).set(tasks[k]);
                }
            }

            profile.end();

            if (progress) {
                logger.stop();
            }

            if (this.linter && (this.linter.hasErrors() || this.linter.hasWarnings())) {
                logger.log(this.linter.report());
            }

            if (progress) {
                logger.success('script ready');
            }

            return this.result;
        } catch (error) {
            if (progress) {
                logger.stop();
            }
            profile.end();
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async write() {
        let progress = this.options.get('progress');
        let output = this.options.get('output');
        await this.result.write(this.config.output);
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

        let plugins = this.options.get('plugins') || [];
        let plugin = plugins.find((p) => p.name === 'eslint');
        if (!plugin) {
            return null;
        }
        return plugin.linter;
    }
}

module.exports = ScriptBundler;
