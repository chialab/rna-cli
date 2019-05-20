const fs = require('fs-extra');
const path = require('path');
const resolve = require('resolve');
const { rollup } = require('rollup');
const { createPrinter } = require('typescript');
const { bundle } = require('dts-apigen');
const { File, Directory } = require('../File');
const Bundler = require('./Bundler');

const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const babel = require('./plugins/rollup-plugin-babel/rollup-plugin-babel');
const postcss = require('./plugins/rollup-plugin-postcss/rollup-plugin-postcss');
const nodeResolve = require('rollup-plugin-node-resolve');
const terser = require('./plugins/rollup-plugin-terser/rollup-plugin-terser');
const worker = require('./plugins/rollup-plugin-worker/rollup-plugin-worker');
const json = require('rollup-plugin-json');
const html = require('./plugins/rollup-plugin-html/rollup-plugin-html');
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

class RollupCache {
    constructor() {
        this.cache = {};
    }

    getCache(format) {
        return this.cache[format] = this.cache[format] || {
            modules: {},
            symlinks: {},
        };
    }

    addBundleToCache(bundleCache, format) {
        bundleCache.modules.forEach((moduleCache) => {
            this.addModuleToCache(moduleCache, format);
        });
    }

    addModuleToCache(moduleCache, format) {
        const { modules, symlinks } = this.getCache(format);

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

        if (id in modules) {
            Object.assign(modules[id], moduleCache);
        } else {
            modules[id] = moduleCache;
        }
        if (symlinkId && !(symlinkId in modules)) {
            let alias = {};
            for (let key in moduleCache) {
                if (key === 'id') {
                    alias.id = symlinkId;
                } else {
                    Object.defineProperty(alias, key, {
                        get() {
                            return modules[id][key];
                        },
                    });
                }
            }
            modules[symlinkId] = alias;
        }
    }

    clear() {
        this.cache = {};
    }

    toConfig(format) {
        const { modules } = this.getCache(format);
        return {
            modules: Object.values(modules),
            plugins: {},
        };
    }
}

const cache = new RollupCache();

class ScriptBundler extends Bundler {
    /**
     * @inheritdoc
     */
    async setup(options = {}) {
        options = Object.assign({}, options);

        let { input, output, code, root } = options;
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
            options.root = root = input.project;
        }

        await super.setup(options);

        let targets = options.targets;
        if (targets === 'esmodules') {
            targets = { esmodules: true };
        } else if (targets === 'node') {
            targets = { node: true };
        } else {
            targets = { browsers: targets };
        }

        let project = (input && input.project) || (root && root.project);
        let babelConfig = {
            include: /\.(mjs|js|jsx|ts)$/,
            babelrc: false,
            compact: false,
            presets: [
                [require('@chialab/babel-preset'), {
                    targets,
                    useBuiltIns: false,
                    modules: false,
                    assertions: options.assertions,
                    coverage: options.coverage,
                    coverageExclude: [
                        ...(project.workspaces ? project.workspaces.map((ws) => ws.directory('node_modules').localPath) : [project.directory('node_modules').localPath]),
                        (project.directories.test || project.directory('test')).localPath,
                    ],
                    pragma: options.jsx && options.jsx.pragma || 'IDOM.h',
                    pragmaFrag: options.jsx && options.jsx.pragmaFrag,
                    pragmaModule: options.jsx && options.jsx.module || '@dnajs/idom',
                    transformCommonjs: true,
                    asyncToPromises: true,
                }],
            ],
            plugins: [
                require('@babel/plugin-syntax-dynamic-import').default,
            ],
        };

        let projectDependencies = null;
        if (project) {
            projectDependencies = [
                ...Object.keys(project.get('dependencies') || {}),
                ...Object.keys(project.get('peerDependencies') || {}),
                ...Object.keys(project.get('devDependencies') || {}),
            ];
        }

        let plugins = [
            code ? {
                resolveId(id) {
                    if (id === input.path) {
                        return id;
                    }
                },
                load(id) {
                    if (id === input.path) {
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
                        let warning = `dependency "${moduleName}" is not listed in ${project.localPath}`;
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
                    this.emit(ScriptBundler.ANALYSIS_EVENT, result);
                },
            }) : {},
            options.lint !== false ? eslint({
                include: /\.(mjs|js|jsx|ts)$/,
                root,
            }) : {},
            /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
            polyfill(),
            nodeResolve({
                mainFields: ['module', 'jsnext', 'jsnext:main', 'main'],
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
            html({
                format: options.format,
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
            }),
            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            project.file('tsconfig.json').exists() ? typescript({
                include: [/\.(ts|tsx)$/],
                clean: true,
                cacheRoot: options.cacheRoot || './.cache',
                abortOnError: true,
            }) : {},
            babel(babelConfig),
            worker(),
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
            const format = this.options.get('format');
            const bundle = this.options.get('bundle');
            if (format !== 'umd' && format !== 'iife' && !bundle && !path.isAbsolute(id) && !id.match(/\.\.?\//)) {
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

        this.options.set('format', this.options.get('format') || 'umd');
        this.options.set('assetFileNames', this.options.get('assetFileNames') || 'assets/[name][extname]');
        this.options.set('plugins', plugins);
        this.options.set('external', external);
    }

    /**
     * @inheritdoc
     */
    async build(...invalidate) {
        await super.build(...invalidate);

        let input = this.options.get('input');
        let output = this.options.get('output');
        let code = this.options.get('code');
        let map = this.options.get('map');
        let typings = this.options.get('typings');

        this.emit(ScriptBundler.BUILD_START, input, code, invalidate);

        try {
            if (!code && input && !input.exists()) {
                throw new Error(`missing "input" file ${input.localPath} for ${this.name}`);
            }

            if (input && !code) {
                this.addResources(input.path);
            }

            if (output && output.exists() && output.isFile() && output.mapFile.exists()) {
                output.mapFile.unlink();
            }

            let config = {
                input: input.path,
                output: {
                    file: (output && output.extname) ? output.path : null,
                    dir: (output && !output.extname) ? output.path : null,
                    name: this.options.get('format') !== 'system' && (this.options.get('name') || camelize(output ? output.path : input.path)),
                    format: this.options.get('format'),
                    sourcemap: (typeof map === 'string') ? map : (map !== false),
                    strict: false,
                    indent: false,
                    assetFileNames: this.options.get('assetFileNames'),
                },
                cache: cache.toConfig(this.options.get('format')),
                plugins: this.options.get('plugins') || [],
                external: this.options.get('external'),
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
            };
            this.config = config;
            this.result = await rollup(config);
            cache.addBundleToCache(this.result.cache, this.options.get('format'));
            delete this.result.cache;
            this.addResources(...this.result.watchFiles.filter((filePath) => fs.existsSync(filePath)));

            let { output: files } = await this.result.generate(config.output);
            this.result.code = files[0].code;
            if (typings) {
                let typingsFile = typings === true ? output.directory.file(`${output.basename}.d.ts`) : typings;
                if (!typingsFile) {
                    this.emit(ScriptBundler.WARN_EVENT, 'missing output path for typings. Add the `types` field in your package.json. Read more here https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html');
                } else {
                    let sourceFile = bundle(input.path);
                    let code = createPrinter().printFile(sourceFile);
                    typingsFile.write(code);
                }
            }

            if (this.linter && (this.linter.hasErrors() || this.linter.hasWarnings())) {
                this.emit(ScriptBundler.LINT_EVENT, this.linter.result);
            }

            this.emit(ScriptBundler.BUILD_END);

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
        let output = this.options.get('output');
        if (!output) {
            return;
        }

        this.emit(ScriptBundler.WRITE_START);

        let res = await this.result.write(this.config.output);
        res.output
            .filter((out) => out.fileName)
            .forEach((out) => {
                if (output.extname) {
                    this.emit(ScriptBundler.WRITE_PROGRESS, output.parent.file(out.fileName));
                } else {
                    this.emit(ScriptBundler.WRITE_PROGRESS, output.file(out.fileName));
                }
            });

        this.emit(ScriptBundler.WRITE_END);

        return res;
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
