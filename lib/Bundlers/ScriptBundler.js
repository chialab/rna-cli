const fs = require('fs-extra');
const path = require('path');
const resolve = require('resolve');
const { rollup } = require('rollup');
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

class RollupCache {
    constructor() {
        this.cache = {};
        this.symlinks = {};
    }

    addBundleToCache(bundle) {
        bundle.cache.modules.forEach((moduleCache) => {
            this.addModuleToCache(moduleCache);
        });
    }

    addModuleToCache(moduleCache) {
        const { cache, symlinks } = this;

        let id = moduleCache.id;
        let symlinkId = symlinks[id];

        if (id in symlinks) {
            let realpath = symlinks[id];
            symlinkId = id;
            id = realpath;
        } else if (fs.existsSync(id)) {
            let realpath = fs.realpathSync(id);
            if (realpath && realpath !== id) {
                symlinkId = id;
                id = realpath;
                symlinks[symlinkId] = id;
            }
        }

        if (id in cache) {
            Object.assign(cache[id], moduleCache);
        } else {
            cache[id] = moduleCache;
        }
        if (symlinkId && !(symlinkId in cache)) {
            let alias = {};
            for (let key in moduleCache) {
                if (key === 'id') {
                    alias.id = symlinkId;
                } else {
                    Object.defineProperty(alias, key, {
                        get() {
                            return cache[id][key];
                        },
                    });
                }
            }
            cache[symlinkId] = alias;
        }
    }

    clear() {
        this.cache = {};
        this.symlinks = {};
    }

    toConfig() {
        return {
            modules: Object.values(this.cache),
            plugins: {},
        };
    }
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

        let { input, output } = options;
        if (!input) {
            throw `missing "input" option for ${this.name}`;
        }
        if (!output) {
            throw `missing "output" option for ${this.name}`;
        }

        await super.setup(options);

        if (!output.extname) {
            output = output.file(input.basename.replace(input.extname, '.js'));
            this.options.set('output', output);
        }

        let isTypescript = input.extname === '.ts';
        let localBabelConf = this.project.file('.babelrc');
        let babelConfig;
        if (localBabelConf.exists()) {
            babelConfig = localBabelConf.readJson();
        } else {
            babelConfig = {
                include: /\.(mjs|js|jsx|ts)$/,
                babelrc: false,
                compact: false,
                presets: [
                    [require('@chialab/babel-preset'), {
                        env: !isTypescript,
                        targets: {
                            browsers: options.targets,
                        },
                        useBuiltIns: options.polyfill ? 'usage' : 'entry',
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
        let project = this.project;
        let projectDependencies = [
            ...Object.keys(project.get('dependencies') || {}),
            ...Object.keys(project.get('peerDependencies') || {}),
        ];

        let plugins = [
            {
                resolveId(importee, importer) {
                    if (!importer) {
                        return null;
                    }
                    if (importer.indexOf('/node_modules/') !== -1) {
                        return null;
                    } else if (importee.indexOf('\0') === 0) {
                        return null;
                    }
                    let split = importee.split('/');
                    let moduleName = split[0];
                    if (importee[0] === '@') {
                        moduleName += `/${split[1]}`;
                    }
                    if (projectDependencies.indexOf(moduleName) === -1) {
                        let warning = `dependency "${importee}" is not listed in ${project.packageJson.localPath}`;
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
                onAnalysis(result) {
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
            nodeResolve({
                module: true,
                jsnext: true,
                main: true,
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
            }),

            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            isTypescript ? typescript({
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
                if (isTypescript) {
                    return id.startsWith('.');
                }
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

        let input = this.options.get('input');

        if (!input.exists()) {
            throw `missing "input" file ${input.localPath} for ${this.name}`;
        }

        let profile = this.getProfiler();
        let logger = this.getLogger();
        profile.start();

        try {
            logger.play(`generating script${invalidate.length ? ' (this will be fast)...' : '...'}`, input.localPath);

            let output = this.options.get('output');
            let map = this.options.get('map');

            this.addResources(input.path);

            if (output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let config = {
                input: input.path,
                output: {
                    file: output.path,
                    name: this.options.get('name') || camelize(output.path),
                    format: this.options.get('format') || 'umd',
                    sourcemap: (typeof map === 'string') ? map : (map !== false),
                    strict: false,
                    indent: false,
                    assetFileNames: this.options.get('assetFileNames') || 'assets/[name][extname]',
                },
                cache: ScriptBundler.cache.toConfig(),
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
            this.result = await rollup(config);
            ScriptBundler.cache.addBundleToCache(this.result);
            delete this.result.cache;
            this.addResources(...this.result.watchFiles.filter((filePath) => fs.existsSync(filePath)));
            // this.checkDependencies();

            await this.result.write(config.output);

            if (this.options.get('profile')) {
                let tasks = this.timings;
                for (let k in tasks) {
                    profile.task(k, false).set(tasks[k]);
                }
            }

            profile.end();
            logger.stop();

            if (this.linter && (this.linter.hasErrors() || this.linter.hasWarnings())) {
                logger.log(this.linter.report());
            }

            let { size, zipped } = output.size;
            logger.info(output.localPath, `${size}, ${zipped} zipped`);
            logger.success('script ready');

            return this.result;
        } catch (error) {
            logger.stop();
            profile.end();
            throw error;
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

ScriptBundler.cache = new RollupCache();

module.exports = ScriptBundler;
