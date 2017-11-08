const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const rollup = require('rollup');
const paths = require('../../../lib/paths.js');
const importer = require('../../../lib/import.js');
const utils = require('../../../lib/utils.js');

const resolve = require('rollup-plugin-node-resolve');
const common = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const sass = require('rollup-plugin-sass-modules');
const uglify = require('rollup-plugin-uglify');
const json = require('rollup-plugin-json');
const url = require('rollup-plugin-url');
const jsx = require('rollup-plugin-external-jsx');
const string = require('rollup-plugin-string');

const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

function getPostCssConfig() {
    let localConf = path.join(paths.cwd, 'postcss.json');
    if (fs.existsSync(localConf)) {
        return require(localConf);
    }
    return {
        browsers: ['last 3 versions'],
    };
}

function getBabelConfig(options) {
    let localConf = path.join(paths.cwd, '.babelrc');
    if (fs.existsSync(localConf)) {
        return JSON.parse(fs.readFileSync(localConf), 'utf8');
    }
    return {
        include: '**/*.{mjs,js,jsx}',
        exclude: [],
        compact: false,
        presets: options.transpile !== false ? [
            [require('babel-preset-env'), {
                targets: {
                    browsers: ['ie >= 11', 'safari >= 8'],
                },
                modules: false,
            }],
        ] : undefined,
        plugins: [
            [require('babel-plugin-transform-react-jsx'), {
                pragma: 'IDOM.h',
            }],
            require('babel-plugin-transform-inline-environment-variables'),
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
                app.log(colors.grey(`Config file: ${localConf}`));
                return conf;
            });
    }
    if (!options.output) {
        app.log(colors.red(`Missing 'output' option for ${options.input}.`));
        return global.Promise.reject();
    }
    const babelConfig = getBabelConfig(options);
    babelConfig.runtimeHelpers = true;
    return global.Promise.resolve({
        name: options.name,
        input: options.input,
        file: options.output,
        sourcemap: options.map !== false ? 'inline' : false,
        format: 'umd',
        strict: false,
        // https://github.com/rollup/rollup/issues/1626
        cache: app.generated[options.input],
        indent: false,
        plugins: [
            resolve(),
            json(),
            string({
                include: [
                    '**/*.{html,txt,svg,md}',
                ],
            }),
            url({
                limit: 10 * 1000 * 1024,
                exclude: [],
                include: [
                    '**/*.{woff,ttf,eot,gif,png,jpg}',
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
                    sourceMap: options.map !== false,
                    sourceMapEmbed: options.map !== false,
                },
            }),
            jsx({
                // Required to be specified
                include: '**/*.jsx',
                // import header
                header: 'import { IDOM } from \'@dnajs/idom\';',
            }),
            babel(babelConfig),
            common(),
            options.production ? uglify({
                output: {
                    comments: /@license/,
                },
            }) : {},
        ],
        onwarn(message) {
            const whitelisted = () => {
                message = message.toString();
                if (message.indexOf('The \'this\' keyword') !== -1) {
                    return false;
                }
                if (message.indexOf('It\'s strongly recommended that you use the "external-helpers" plugin') !== -1) {
                    return false;
                }
                return true;
            };
            if (message && options.verbose || whitelisted()) {
                app.log(colors.yellow(`⚠️  ${message}`));
            }
        },
    });
}

module.exports = (app, options) => {
    let prev = app.generatedOptions[options.input];
    if (prev) {
        options = app.generatedOptions[options.input];
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
        options.name = utils.camelize(
            path.basename(options.input, path.extname(options.input))
        );
    }
    if (options.transpile === false) {
        app.log(colors.yellow('⚠️ skipping Babel task.'));
    }
    let task = app.log(`bundling${app.generated[options.input] ? ' [this will be fast]' : ''}... ${colors.grey(`(${options.input})`)}`, true);
    return getConfig(app, options)
        .then((config) =>
            rollup.rollup(config)
                .then((bundler) => {
                    options.output = options.output || config.output;
                    app.generated[options.input] = bundler;
                    app.generatedOptions[options.input] = options;
                    return bundler.write(config)
                        .then(() => {
                            task();
                            app.log(`${colors.bold(colors.green('bundle ready!'))} ${colors.grey(`(${options.output})`)}`);
                            return global.Promise.resolve(bundler);
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
