# Command: `documentation`

It uses the [documentation package](http://documentation.js.org/) to generate API references of modules in Markdown format.

### Options

* `--output` The output dir for documentation files.

### Usage
```sh
# Generate API reference for the current project (o for all projects if monorepo).
$ rna documentation --output docs

# Generate API reference for multiple files.
$ rna documentation ./module1/index.js ./module2/index.js --output docs
```
