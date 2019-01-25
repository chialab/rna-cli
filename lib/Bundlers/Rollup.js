const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');
const resolve = require('resolve');
const { rollup } = require('rollup');
const ESLint = require('../Linters/ESLint');
const PostCSS = require('./PostCSS');

const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const babel = require('./plugins/rollup-plugin-babel/rollup-plugin-babel');
const postcss = require('./plugins/rollup-plugin-postcss/rollup-plugin-postcss');
const nodeResolve = require('rollup-plugin-node-resolve');
const terser = require('./plugins/rollup-plugin-terser/rollup-plugin-terser');
const json = require('rollup-plugin-json');
const url = require('./plugins/rollup-plugin-url/rollup-plugin-url');
const string = require('./plugins/rollup-plugin-string/rollup-plugin-string');
const optimize = require('rollup-plugin-optimize-js');
const typescript = require('rollup-plugin-typescript2');
const po = require('./plugins/rollup-plugin-po/rollup-plugin-po');

function getBabelConfig(project, options) {
    const localConf = project.file('.babelrc');
    const isTypescript = path.extname(options.input) === '.ts';

    if (localConf.exists()) {
        return localConf.readJson();
    }

    return {
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

function getConfig(app, project, options) {
    const babelConfig = getBabelConfig(project, options);
    const eslintConfig = ESLint.detectConfig(app, project);
    const postCSSConfig = PostCSS.detectConfig(app, project, options);
    const isTypescript = path.extname(options.input) === '.ts';

    return {
        input: options.input,
        output: {
            file: options.output,
            name: options.name || camelize(options.output),
            format: options.format || 'umd',
            sourcemap: (typeof options.map === 'string') ? options.map : (options.map !== false),
            strict: false,
            indent: false,
            assetFileNames: path.join(options.assetFileNames || 'assets', '[name][extname]'),
        },
        plugins: [
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
            postcss({
                exclude: [],
                include: [
                    /\.(css|scss|sass)$/,
                ],
                options: postCSSConfig,
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
            options.optimize ? optimize() : {},
        ],
        external(id) {
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
        },
        perf: true,
        preserveSymlinks: true,
    };
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

class Rollup extends EventEmitter {
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
        super();
        this.options = Object.assign({}, options);
    }

    /**
     * Check if modules from the bundle have some import that is missing in the closest `package.json`.
     * @fires warning Fired when missing dependencies are found.
     */
    checkDependencies() {
        // This RegExp matches strings starting with: '/', './', '../', '\u0000rollup' (the slash is relative to the OS).
        const pathRegex = new RegExp(`^(\\.{1,2}\\${path.sep}|\\x00rollup)`);
        const modulesToCheck = this.result.modules
            // Filter modules to process excluding not '.js' files and files from 'node_modules'.
            .filter((mod) => !mod.id.includes('/node_modules/') && mod.id.endsWith('.js'))
            .map((mod) => ({
                id: mod.id,
                // Filter dependencies by these criteria: not matching the RegExp above, not absolute path, not an existing file.
                dependencies: Object.keys(mod.resolvedIds)
                    .filter((dep) =>
                        !pathRegex.test(dep) &&
                        !path.isAbsolute(dep) &&
                        !fs.existsSync(dep)
                    )
                    .map((depFile) => {
                        if (depFile[0] === '@') {
                            return depFile.split('/').slice(0, 2).join('/');
                        }
                        return depFile.split('/')[0];
                    }),
            }));

        let warnings = [];
        modulesToCheck.forEach((mod) => {
            let parent = path.dirname(mod.id);
            // Search for closest package.json. Stop digging at `process.cwd`.
            while (!fs.existsSync(path.resolve(parent, 'package.json')) && parent !== path.dirname(parent)) {
                parent = path.dirname(parent);
            }
            try {
                const packageJsonPath = path.resolve(parent, 'package.json');
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = Object.keys(packageJson.dependencies || {});
                const peerDependencies = Object.keys(packageJson.peerDependencies || {});
                const missingDeps = mod.dependencies.filter((id) =>
                    !dependencies.some((dep) => dep === id) &&
                    !peerDependencies.some((peerDep) => peerDep === id));
                if (!missingDeps.length) {
                    return;
                }
                missingDeps.forEach((dep) => {
                    let warning = `dependency "${dep}" is not listed in ${packageJsonPath}`;
                    // Avoid duplicate warnings.
                    if (warnings.includes(warning)) {
                        return;
                    }
                    warnings.push(warning);
                });
            } catch (error) {
                //
            }
        });

        warnings.forEach((warn) => this.emit('warning', warn));
    }

    async build() {
        let config = Object.assign({
            cache: Rollup.cache.toConfig(),
            onwarn: (warning) => {
                if (warning.code === 'UNRESOLVED_IMPORT') {
                    throw warning;
                }
                this.emit('warning', warning);
            },
        }, this.options);
        this.result = await rollup(config);
        Rollup.cache.addBundleToCache(this.result);
        delete this.result.cache;
        this.checkDependencies();
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
            this.options.input,
            // get bundle dependencies
            ...this.result.modules
                .reduce((dependencies, mod) => {
                    dependencies.push(
                        ...(mod.dependencies || [])
                            // filter files
                            .filter((p) => fs.existsSync(p))
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

Rollup.cache = new RollupCache();

module.exports = Rollup;
