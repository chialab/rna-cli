It uses [Rollup](https://rollupjs.org/) and [postCSS](https://postcss.org/) to bundle JavaScript and style files.

It supports:
* TypeScript
* Future JavaScript versions and JSX syntax with Babel
* JSON files
* Assets files (images, fonts, ...)

### Options

* `--output` Specify the output file or directory for the build.
* `--targets` Set specific targets for the build using a [Browserslist](https://github.com/browserslist/browserslist). This query is used by Babel and postCSS to transpile JavaScript and CSS files in order to be compatible with the specified browsers. Use `--no-targets` to prevent code transpiling.
* `--name` For JavaScript builds, you can specify the name of the global variable to use for the bundle.
* `--format` Specify the format of the JavaScript bundle. Available formats are `es`, `umd` (default), `iife` and `cjs`.
* `--production` Minify the output of the JavaScript and CSS bundles.
* `declaration` Enable TypeScript `.d.ts` generation.
* `--watch` Watch source files and rebuild the bundle every time a file change occurred.
* `--no-map` Disable source maps creation. It speeds up the build but you will lose code mapping in the debugger.
* `--no-lint` Disable linting of the source files. See the [`lint` command](../lint/).
* `--jsx.pragma` The pragma to use for JSX transformations.
* `--jsx.module` The module which contains the pragma reference.
* `--polyfill` Try to polyfill the bundle using Babel polyfills.
* `--optimize` Try to optimize the bundle with `OptimizeJS`.

### See also

* [`rna unit`](../unit/)
* [`rna serve`](../serve/)
