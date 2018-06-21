const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const rollup = require('rollup');
const resolve = require('resolve');
const paths = require('../../../lib/paths.js');
const importer = require('../../../lib/import.js');
const utils = require('../../../lib/utils.js');
const BundleManifest = require('../../../lib/bundle.js');

const babel = require('../plugins/rollup-plugin-babel/rollup-plugin-babel');
const sass = require('rollup-plugin-sass-modules');
const uglify = require('rollup-plugin-uglify');
const json = require('rollup-plugin-json');
const url = require('rollup-plugin-url');
const string = require('../plugins/rollup-plugin-string/rollup-plugin-string');
const optimize = require('rollup-plugin-optimize-js');

const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

const caches = {};

function getBabelConfig(options) {
    const localConf = path.join(paths.cwd, '.babelrc');
    if (fs.existsSync(localConf)) {
        return JSON.parse(fs.readFileSync(localConf), 'utf8');
    }

    const plugins = [
        [require('../plugins/babel-plugin-resolve/babel-plugin-resolve.js'), {
            modulesPaths: [path.join(paths.cwd, 'node_modules')],
            exclude: ['\0rollupPluginBabelHelpers', 'rollupCommonGlobal'],
        }],
    ];

    return {
        include: /\.(mjs|js|jsx)$/,
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

function getConfig(app, bundler, options) {
    let config;
    if (bundler && bundler.config) {
        config = bundler.config;
        config.cache = bundler;
    } else {
        let localConf = path.join(paths.cwd, 'rollup.config.js');
        if (fs.existsSync(localConf)) {
            return importer(localConf)
                .then((conf) => {
                    if (!conf.input) {
                        conf.input = options.input;
                    }
                    app.log(colors.grey(`Config file: ${localConf}`));
                    return conf;
                });
        }
        if (!options.output) {
            app.log(colors.red(`Missing 'output' option for ${options.input}.`));
            return global.Promise.reject();
        }
        const babelConfig = getBabelConfig(options);
        config = {
            input: options.input,
            output: {
                file: options.output,
                name: options.name,
                format: 'umd',
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
                    limit: 10 * 1000 * 1024,
                    exclude: [],
                    include: [
                        /\.(woff|ttf|eot|gif|png|jpg)$/,
                    ],
                }),
                sass({
                    processor: (css) =>
                        postcss(
                            [
                                autoprefixer(options.targets),
                            ]
                        ).process(css, {
                            // disable sourcemaps warning
                            // TODO: add sourcemaps support
                            from: undefined,
                        }).then(result => result.css),
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
                babel(babelConfig),
                options.production ? uglify({
                    output: {
                        comments: /@license/,
                    },
                }, require('uglify-es').minify) : {},
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
                return resolve.isCore(id);
            },
            perf: app.options.profile,
        };
    }

    return global.Promise.resolve(config);
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
            tasks.treeshaking += timings[key];
        } else if (key.match(/sourcemap/)) {
            tasks.sourcemaps += timings[key];
        } else if (key.match(/generate ast/)) {
            tasks.parsing += timings[key];
        } else if (key.match(/plugin/)) {
            let match = key.match(/plugin\s*(\d*)(?:\s*\(([\w-_]*)\))?/i);
            let name = match[2] || match[1];
            tasks[name] = tasks[name] || 0;
            tasks[name] += timings[key];
        }
    });
    for (let k in tasks) {
        profile.task(k, false).set(tasks[k]);
    }
}

module.exports = (app, options, profiler) => {
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
        app.log(colors.yellow('🚢 setting "production" environment.'));
        process.env.NODE_ENV = 'production';
    }
    let profile = profiler.task('rollup');
    let previousBundler = caches[options.input];
    let task = app.log(`bundling${previousBundler ? ' [this will be fast]' : ''}... ${colors.grey(`(${options.input})`)}`, true);
    return getConfig(app, previousBundler, options)
        .then((config) =>
            rollup.rollup(config)
                .then((bundler) => {
                    options.output = options.output || config.output;
                    bundler.config = config;
                    caches[options.input] = bundler;
                    return bundler.write(config.output)
                        .then(() => {
                            if (app.options.profile) {
                                timeReport(profile, bundler);
                            }
                            profile.end();
                            task();
                            app.log(`${colors.bold(colors.green('bundle ready!'))} ${colors.grey(`(${options.output})`)}`);
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
                            return global.Promise.resolve(manifest);
                        });
                })
        )
        .catch((err) => {
            task();
            if (err) {
                app.log(err);
            }
            app.log(colors.red(`error bundling ${options.name}`));
            return global.Promise.reject();
        });
};
