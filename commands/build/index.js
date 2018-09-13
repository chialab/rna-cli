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
 * css/sass/scss (with dart-sass)
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
        .option('[--targets]', 'A supported browserslist query. Use --no-targets to transpile only non-standard features.')
        .option('[--name]', 'The bundle name.')
        .option('[--format]', 'The bundle format (es, umd, iife, cjs).')
        .option('[--production]', 'Minify bundle.')
        .option('[--declaration]', 'Generate typescript declarations.')
        .option('[--watch]', 'Watch sources and rebuild on files changes.')
        .option('[--no-map]', 'Do not produce source map.')
        .option('[--no-lint]', 'Do not lint files before bundle.')
        .option('[--jsx.pragma]', 'The JSX pragma to use.')
        .option('[--jsx.module]', 'The module to auto import for JSX pragma.')
        .option('[--polyfill]', 'Auto add polyfills. [⚠️  experimental]')
        .option('[--optimize]', 'Run OptimizeJS after bundle. [⚠️  experimental]')
        .action(`${__dirname}/action.js`);
};
