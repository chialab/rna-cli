const fs = require('fs');
const path = require('path');
const rollup = require('rollup');
const Proteins = require('@chialab/proteins');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');
const importer = require('../../lib/import.js');
const bundles = require('../../lib/bundles.js');

const resolve = require('rollup-plugin-node-resolve');
const common = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const sass = require('rollup-plugin-sass-modules');
const uglify = require('rollup-plugin-uglify');
const json = require('rollup-plugin-json');
const url = require('rollup-plugin-url');
const jsx = require('rollup-plugin-external-jsx');

const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

function camelize(str) {
    return str.split('/').pop().replace(/(^[a-z0-9]|[-_]([a-z0-9]))/g, (g) => (g[1] || g[0]).toUpperCase());
}

function getPostCssConfig() {
    let localConf = path.join(paths.cwd, 'postcss.json');
    if (fs.existsSync(localConf)) {
        return require(localConf);
    }
    return {
        browsers: ['last 3 versions'],
    };
}

function getBabelConfig() {
    let localConf = path.join(paths.cwd, '.babelrc');
    if (fs.existsSync(localConf)) {
        return JSON.parse(fs.readFileSync(localConf), 'utf8');
    }
    return {
        exclude: [],
        compact: false,
        presets: [
            [require('babel-preset-env'), {
                targets: {
                    browsers: ['ie >= 11', 'safari >= 8'],
                },
                modules: false,
            }],
        ],
        plugins: [
            require('babel-plugin-transform-inline-environment-variables'),
            [require('babel-plugin-transform-react-jsx'), {
                pragma: 'IDOM.h',
            }],
        ],
    };
}

function getConfig(app, options) {
    let localConf = path.join(paths.cwd, 'rollup.config.js');
    if (fs.existsSync(localConf)) {
        return importer(localConf)
            .then((conf) => {
                if (!conf.input) {
                    conf.input = options.input;
                }
                app.log(`Config file: ${localConf}`.grey);
                return conf;
            });
    }
    if (!options.output) {
        app.log(`Missing 'output' option for ${options.input}.`.red);
        return global.Promise.reject();
    }
    return global.Promise.resolve({
        name: options.name,
        input: options.input,
        file: options.output,
        sourcemap: options.map !== false ? 'inline' : false,
        format: 'umd',
        strict: false,
        // https://github.com/rollup/rollup/issues/1626
        cache: bundles.generated[options.input],
        plugins: [
            resolve(),
            json(),
            url({
                limit: 10 * 1000 * 1024,
                exclude: [],
                include: [
                    '**/*.{woff,ttf,eot,svg,gif,png,jpg}',
                ],
            }),
            sass({
                processor: (css) =>
                    postcss(
                        [
                            autoprefixer(getPostCssConfig()),
                        ]
                    ).process(css).then(result => result.css),
                exclude: [],
                include: [
                    '**/*.{css,scss,sass}',
                ],
                options: {
                    outFile: options['external-css'] && path.join(
                        path.dirname(options.output),
                        `${path.basename(options.output, path.extname(options.output))}.css`
                    ),
                    sourceMap: options.map !== false,
                    sourceMapEmbed: options.map !== false,
                    outputStyle: options.production ? 'compressed' : 'expanded',
                },
            }),
            jsx({
                // Required to be specified
                include: '**/*.jsx',
                // import header
                header: 'import { IDOM } from \'@dnajs/idom\';',
            }),
            babel(getBabelConfig()),
            common(),
            options.production ? uglify({
                output: {
                    comments: /@license/,
                },
            }) : {},
        ],
        onwarn(message) {
            if (options.verbose) {
                app.log(`⚠️  ${message}`);
            }
        },
    });
}

function bundle(app, options) {
    let prev = bundles.generated[options.input];
    if (prev) {
        options.output = options.output || prev.output;
        options.name = options.name || prev.name;
    } else if (options.output) {
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
        options.name = camelize(
            path.basename(options.input, path.extname(options.input))
        );
    }
    let task = app.log(`bundling "${options.input}"...`, true);
    return getConfig(app, options)
        .then((config) =>
            rollup.rollup(config)
                .then((bundler) => {
                    options.output = options.output || config.output;
                    bundler.output = options.output;
                    bundler.name = options.name;
                    bundles.generated[options.input] = bundler;
                    return bundler.write(config)
                        .then(() => {
                            task();
                            app.log(`${'bundle ready!'.bold} ${`(${options.output})`.grey}`);
                            return global.Promise.resolve(bundler);
                        });
                })
        )
        .catch((err) => {
            task();
            app.log(`Error bundling ${options.name}`.red);
            return global.Promise.reject(err);
        });
}

module.exports = (program) => {
    program
        .command('build')
        .description('Build the project.')
        .help(`It uses \`rollup\` (https://rollupjs.org/) to bundle the source code.
It handles multiple sources:

 * JS and JSX (transpiled with Babel)
 * css/sass/scss (with node-sass)
 * json
 * binary files as blob urls
 * other JS modules (ES6, commonjs)

It also produce sourcemaps and uglify the code in production mode.

A default configuration is also provided.
Anyway, the developer can use a custom configuration if the \`rollup.config.js\` file exists in the root of the project.
It supports \`.babelrc\` too, to replace the default babel configuration.`)
        .option('[file]', 'The file to build.')
        .option('[package1] [package2] [package3]', 'The packages to build.')
        .option('--name', 'The bundle name.')
        .option('--output', 'The destination file.')
        .option('--production', 'Uglify bundle.')
        .option('--external-css', 'Create an external css file.')
        .option('--no-map', 'Do not produce source map.')
        .action((app, options = {}) => {
            options = Proteins.clone(options);
            if (!paths.cwd) {
                app.log('No project found.'.red);
                return global.Promise.reject();
            }
            let filter = optionsUtils.handleArguments(options);
            let promise = global.Promise.resolve();
            Object.values(filter.packages).forEach((pkg) => {
                promise = promise.then(() => {
                    let json = pkg.json;
                    if (!json.main && !options.output) {
                        app.log(`Missing 'output' property for ${pkg.name} module.`.red);
                        return global.Promise.reject();
                    }
                    let opts = Proteins.clone(options);
                    if (json.module) {
                        opts.input = path.join(pkg.path, json.module);
                        opts.output = path.join(pkg.path, json.main);
                    } else {
                        opts.input = path.join(pkg.path, json.main);
                    }
                    opts.name = camelize(json.name);
                    return bundle(app, opts);
                });
            });
            filter.files.forEach((file) => {
                promise = promise.then(() => {
                    let opts = Proteins.clone(options);
                    opts.input = file;
                    if (opts.output) {
                        if (filter.files.length > 1) {
                            opts.output = path.resolve(path.dirname(file), opts.output);
                        }
                    }
                    return bundle(app, opts);
                });
            });

            return promise;
        });
};