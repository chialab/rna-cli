RNA can build (and bundle) style files with CSS or SCSS syntax:

```sh
$ rna build src/index.scss --output public/index.css
```

A source map will be generated (it can be disabled via the --no-map flag) and all included files will be linted (unless --no-lint is specified).

RNA will also minify the final CSS code if the flag `--production` is passed.

## Transpiling

RNA uses [PostCSS](https://postcss.org/) to transpile non-standard or non supported CSS syntax for the specified target. It also convert SCSS syntax via [dart-sass](https://sass-lang.com/dart-sass). The target of the build can be specified with the `--targets '<browser list query>'` options.

This task will also prefix rules when needed, useful for CSS transformation, flexbox and grid.

## Bundling

Dart Sass bundles all `@import path/to/file.scss` statements, while PostCSS collects all `@import url('path/to/file.css')`. The generated CSS files will include all imported files.

### Module resolution

Generally, CSS `@import` should reference to an URL or a local file, but RNA can also handle NPM references. This is pretty useful if you are using dependencies that need to load their own CSS and you want to avoid conflicts with `node_modules` path.

```scss
/* import the `style` field in the package.json of the dependency */
@import '@chialab/bootstap';
/* load a specific file of the dependency */
@import '@chialab/bootstrap/dist/bootstrap';
```

RNA is able to check and resolve NPM dependencies during the bundle phase. When importing a style module without specifying a file, the `style` field in the dependency package.json will be used.

## Assets

All file referenced by the `url('...')` statement will be collected and copied along the distribution file.