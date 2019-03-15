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

* `--output <file>` Specify the output file or directory for the build.
* `--targets` Set specific targets for the build using a [Browserslist](https://github.com/browserslist/browserslist). This query is used by Babel and PostCSS to transpile JavaScript and CSS files in order to be compatible with the specified browsers. Use `--no-targets` to prevent code transpiling.
* `--name` For JavaScript builds, you can specify the name of the global variable to use for the bundle.
* `--format` Specify the format of the JavaScript bundle. Available formats are `es`, `umd` (default), `iife` and `cjs`.
* `--production` Minify the output of the JavaScript and CSS bundles.
* `--declaration` Enable TypeScript `.d.ts` generation.
* `--watch` Watch source files and rebuild the bundle every time a file change occurred.
* `--no-map` Disable source maps creation. It speeds up the build but you will lose code mapping in the debugger.
* `--no-lint` Disable linting of the source files.
* `--jsx.pragma` The pragma to use for JSX transformations.
* `--jsx.module` The module which contains the pragma reference.
* `--polyfill` Try to polyfill the bundle using Babel polyfills.

### HTML

@todo

### JavaScript, TypeScript and modules

@todo

### CSS and Sass

@todo

### Internationalization

RNA can bundle all `.po` files with same language and namespace into a single JSON asset file, compatibile with the i18next library.
Internationalization files must follow the pattern `path/to/locale/files/{{ lang }}/{{ namespace }}.po` in order to be correctly bundled.

### See also

* [`rna lint`](../lint/)
* [`rna unit`](../unit/)
* [`rna serve`](../serve/)
