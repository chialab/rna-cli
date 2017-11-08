/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
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
        .option('<file>', 'The file to build.')
        .option('<package1> <package2> <package3>', 'The packages to build.')
        .option('--output', 'The destination file.')
        .option('[--name]', 'The bundle name.')
        .option('[--production]', 'Uglify bundle.')
        .option('[--no-map]', 'Do not produce source map.')
        .option('[--no-transpile]', 'Skip Babel task. [⚠️  experimental]')
        .option('[--external-css]', 'Split out css files from bundle. [⛔️  deprecated]')
        .action((app, options = {}) => require('./action')(app, options));
};
