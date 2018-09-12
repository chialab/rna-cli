const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const rollup = require('rollup');
const paths = require('../../../lib/paths.js');
const importer = require('../../../lib/import.js');
const utils = require('../../../lib/utils.js');
const BundleManifest = require('../../../lib/bundle.js');
const fileSize = require('../../../lib/file-size.js');

const babel = require('../plugins/rollup-plugin-babel/rollup-plugin-babel');
const sass = require('../plugins/rollup-plugin-sass-modules/rollup-plugin-sass-modules');
const { terser } = require('rollup-plugin-terser');
const json = require('rollup-plugin-json');
const url = require('rollup-plugin-url');
const string = require('../plugins/rollup-plugin-string/rollup-plugin-string');
const optimize = require('rollup-plugin-optimize-js');
const typescript = require('rollup-plugin-typescript2');

const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

const caches = {};

async function getBabelConfig(options) {
    const localConf = path.join(paths.cwd, '.babelrc');
    if (fs.existsSync(localConf)) {
        return JSON.parse(fs.readFileSync(localConf), 'utf8');
    }

    const plugins = [
        require('@babel/plugin-syntax-dynamic-import').default,
        [require('../plugins/babel-plugin-resolve/babel-plugin-resolve.js'), {
            modulesPaths: [path.join(paths.cwd, 'node_modules')],
            exclude: [/^\\0/],
            jsNext: true,
        }],
    ];

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
        plugins,
    };
}

async function getConfig(app, bundler, options) {
    if (bundler && bundler.config) {
        bundler.config.cache = bundler;
        return bundler.config;
    }

    let localConf = path.join(paths.cwd, 'rollup.config.js');
    if (fs.existsSync(localConf)) {
        let conf = await importer(localConf);
        if (!conf.input) {
            conf.input = options.input;
        }
        app.log(colors.grey(`Config file: ${localConf}`));
        return conf;
    }
    if (!options.output) {
        throw `Missing 'output' option for ${options.input}.`;
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
            /** PLUGINS THAT HAVE EFFECTS ON IMPORT HANDLING */
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
                async processor(text) {
                    let { css } = await postcss([
                        autoprefixer(options.targets),
                    ]).process(text, {
                        // disable sourcemaps warning
                        // TODO: add sourcemaps support
                        from: undefined,
                    });
                    return css;
                },
                options: {
                    sourceMap: options.map !== false,
                    sourceMapEmbed: options.map !== false,
                },
            }),

            /** PLUGINS THAT HAVE EFFECTS ON TRANSPILING AND CODE IN GENERAL */
            path.extname(options.input) === '.ts' ? typescript({
                include: [/\.(ts|tsx)$/],
                clean: true,
                cacheRoot: path.join(paths.tmp, 'rtp'),
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
                app.log(colors.yellow(`⚠️  ${message}`));
            }
        },
        external(id) {
            try {
                if (id && !path.isAbsolute(id) && require.resolve(id, { paths: [paths.cwd] }) === id) {
                    // core nodejs modules
                    return true;
                }
            } catch (err) {
                //
            }
            return false;
        },
        perf: app.options.profile,
    };
}

function timeReport(profile, bundle) {
    let timings = bundle.getTimings();
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

module.exports = async(app, options, profiler) => {
    if (options.output) {
        options.output = path.resolve(paths.cwd, options.output);
        let final = options.output.split(path.sep).pop();
        if (!final.match(/\./)) {
            options.output = path.join(
                options.output,
                path.basename(options.input)
            );
        }
    }
    if (!options.name) {
        options.name = utils.camelize(
            path.basename(options.output, path.extname(options.output))
        );
    }
    if (options.production && !process.env.hasOwnProperty('NODE_ENV')) {
        // Set NODE_ENV environment variable if `--production` flag is set.
        app.log(colors.yellow('🚢  setting "production" environment.'));
        process.env.NODE_ENV = 'production';
    }
    let profile = profiler.task('rollup');
    let previousBundler = caches[options.input];
    let task = app.log(`bundling${previousBundler ? ' [this will be fast]' : ''}... ${colors.grey(`(${path.relative(paths.cwd, options.input)})`)}`, true);
    try {
        let config = await getConfig(app, previousBundler, options);
        let bundler = await rollup.rollup(config);
        options.output = options.output || config.output;
        bundler.config = config;
        caches[options.input] = bundler;
        await bundler.write(config.output);
        if (app.options.profile) {
            timeReport(profile, bundler);
        }
        profile.end();
        task();
        app.log(colors.bold(colors.green('bundle ready!')));
        app.log(fileSize(options.output));
        let manifest = new BundleManifest(options.input, options.output);
        // get bundle dependencies
        bundler.modules.forEach((mod) => {
            let dependencies = mod.dependencies || [];
            // filter files
            dependencies = dependencies.filter((p) => fs.existsSync(p));
            // map to real files
            dependencies = dependencies.map((p) => fs.realpathSync(p));
            // add to manifest
            manifest.addFile(...dependencies);
        });
        return manifest;
    } catch (err) {
        profile.end();
        task();
        throw err;
    }
};
