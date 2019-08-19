Build and bundle project files for distribution.

Features:
* Perform a build of **HTML** files: assets will be copied to the output path and style and script files will be bundled. Generation of favicons and home screen icons is supported, as well as `.webmanifest` generation.
* **JavaScript** and **TypeScript** files and modules will be transpiled via [Babel](https://babeljs.io/) and bundled with [Rollup](https://rollupjs.org/).
* **CSS** and **Sass** files will be compiled and bundled via [PostCSS](https://postcss.org/) and [Dart Sass](https://sass-lang.com/dart-sass).
* **JSON** files imported in modules are treated as namespaces.
* **Images** and **Fonts** imported in modules and css will be copied to the outpath path and references will be updated.
* **Internationalization** files (`.po`) will be compiled using `gettext` into JSON files. You can use it with [i18next](https://www.i18next.com/).

### Usage

```sh
rna build <input> [...options]
```

### Options

* `--output <file|dir>` Specify the output file or directory for the build.
* `--targets` Set specific targets for the build using a [Browserslist](https://github.com/browserslist/browserslist). This query is used by Babel and PostCSS to transpile JavaScript and CSS files in order to be compatible with the specified browsers. Use `--no-targets` to prevent code transpiling.
* `--name` For JavaScript builds, you can specify the name of the global variable to use for the bundle.
* `--format` Specify the format of the JavaScript bundle. Available formats are `es`, `umd`, `iife` and `cjs`.
* `--bundle` Should bundle dependencies along the source files.
* `--production` Minify the output of the JavaScript and CSS bundles.
* `--polyfills` Should include polyfills based on `--targets` query.
* `--watch` Watch sources and rebuild on files changes.
* `--no-map` Do not produce source map.
* `--no-lint` Do not lint files before build.
* `--jsx.pragma` The JSX pragma to use.
* `--jsx.pragmaFrag` The JSX pragma fragment to use.
* `--jsx.module` The module to auto import for JSX pragma.
* `--typings [file]` Generate typescript declarations.
* `--analyze` Print analytic report for script size.

### See also

* [`rna lint`](../lint/)
* [`rna unit`](../unit/)
* [`rna serve`](../serve/)
* [Build JS modules](https://github.com/chialab/rna-cli/wiki/Build-js-modules)
* [Build CSS modules](https://github.com/chialab/rna-cli/wiki/Build-css-modules)
* [Build WebApps](https://github.com/chialab/rna-cli/wiki/Build-WebApps)
