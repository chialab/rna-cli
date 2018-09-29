const fs = require('fs-extra');
const path = require('path');
const rollup = require('rollup');
const colors = require('colors/safe');
const { cwd, tmp } = require('../paths.js');
const BundleManifest = require('../bundle.js');

const eslint = require('./plugins/rollup-plugin-eslint/rollup-plugin-eslint');
const babel = require('./plugins/rollup-plugin-babel/rollup-plugin-babel');
const sass = require('./plugins/rollup-plugin-sass-modules/rollup-plugin-sass-modules');
const resolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const json = require('rollup-plugin-json');
const url = require('rollup-plugin-url');
const string = require('./plugins/rollup-plugin-string/rollup-plugin-string');
const optimize = require('rollup-plugin-optimize-js');
const typescript = require('rollup-plugin-typescript2');

const CACHE = new Map();

async function getBabelConfig(options) {
    const localConf = path.join(cwd, '.babelrc');
    if (fs.existsSync(localConf)) {
        return JSON.parse(fs.readFileSync(localConf), 'utf8');
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
            }],
        ],
        plugins: [
            require('@babel/plugin-syntax-dynamic-import').default,
        ],
    };
}

async function getConfig(bundler, options) {
    if (bundler && bundler.config) {
        bundler.config.cache = bundler;
        return bundler.config;
    }

    const babelConfig = await getBabelConfig(options);
    return {
        input: options.input,
        output: {
            file: options.output,
            name: options.name,
            format: options.format || 'umd',
            sourcemap: (typeof options.map === 'string') ? options.map : (options.map !== false),
            strict: false,
            indent: false,
        },
        plugins: [
            options.lint !== false ? eslint({
                include: /\.(mjs|js|jsx|ts)$/,
            }) : {},
            /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
            resolve({
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
            sass({
                exclude: [],
                include: [
                    /\.(css|scss|sass)$/,
                ],
                options: {
                    sourceMap: options.map !== false,
                    sourceMapEmbed: options.map !== false,
                },
            }),

            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            path.extname(options.input) === '.ts' ? typescript({
                include: [/\.(ts|tsx)$/],
                clean: true,
                cacheRoot: path.join(tmp, 'rtp'),
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
                if (id && !path.isAbsolute(id) && require.resolve(id, { paths: [cwd] }) === id) {
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

module.exports = class Rollup {
    /**
     * Import a module into project.
     *
     * The imported module will be digested by rollup to ensured it is compiled.
     *
     * @param {string} mod Module name.
     * @returns {Promise}
     */
    static async detectConfig(mod = `${cwd}/rollup.config.js`) {
        if (!fs.existsSync(mod)) {
            return null;
        }
        mod = fs.realpathSync(mod);
        let bundle = await rollup.rollup({
            input: mod,
        });
        let res = await bundle.generate({
            format: 'cjs',
        });
        const defaultLoader = require.extensions['.js'];
        require.extensions['.js'] = (m, filename) => {
            if (filename === mod) {
                // Project file: just compile it.
                m._compile(res.code, filename);
            } else {
                // External module: fallback to default loader.
                defaultLoader(m, filename);
            }
        };
        return require(mod);
    }

    get linter() {
        if (!this.bundle) {
            return null;
        }

        let plugin = this.bundle.config.plugins.find((p) => p.name === 'eslint');
        if (!plugin) {
            return null;
        }
        return plugin.linter;
    }

    constructor(options = {}) {
        this.options = Object.assign({}, options);
    }

    async build(options = {}) {
        options = Object.assign({}, this.options, options);
        let previousBundler = CACHE.get(options.input);
        let config = options.config;
        if (!config) {
            config = await getConfig(previousBundler, options);
        }
        if (!config.output) {
            throw `Missing 'output' option for ${options.input}.`;
        }
        let bundle = this.bundle = await rollup.rollup(config);
        options.output = options.output || config.output;
        bundle.config = config;
        CACHE.set(options.input, bundle);
        await bundle.write(config.output);

        let manifest = new BundleManifest(options.input, options.output);
        // get bundle dependencies
        bundle.modules.forEach((mod) => {
            let dependencies = mod.dependencies || [];
            // filter files
            dependencies = dependencies.filter((p) => fs.existsSync(p));
            // map to real files
            dependencies = dependencies.map((p) => fs.realpathSync(p));
            // add to manifest
            manifest.addFile(...dependencies);
        });
        return manifest;
    }

    timings() {
        let timings = this.bundle.getTimings();
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
};
