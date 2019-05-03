It uses the [dts-apigen](https://github.com/chialab/dts-apigen) to generate API references of modules in Markdown format.

### Options

* `--output <directory|file>` The output dir for documentation files.
* `--mode [mode]` The mode to use for markdown documentation. Accepted values are `module` and `files`.
* `--header [content]` A custom header for markdown documentation.
* `--footer [content]` A custom footer for markdown documentation.

### Usage
```sh
# Generate API reference for the current project (o for all projects if monorepo).
$ rna documentate --output API.md

# Generate API reference for multiple files.
$ rna documentate ./module1/index.js ./module2/index.js --output docs
```
