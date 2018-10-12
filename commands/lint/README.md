# Command: `lint`

It uses [ESLint](https://eslint.org/) for JavaScript files and [Stylelint](https://stylelint.io/) for CSS.

It looks for `.eslintrc.yml` and `.stylelintrc.yml` files in the project folder and fallback to RNA config files missing. RNA rules for [JavaScript](../../.eslintrc.yml) and [Style](../../.stylelint.yml) extends default ones, with support for Sass syntax, `async` and `await` JavaScript statements and Class' private fields through the [`babel-eslint`](https://github.com/babel/babel-eslint) plugin.

The same config files resolution is used for the `build` command.

### Options

* `--fix` Enable automatic fix for fixable warnings.
* `--watch` Enable watch modes on files to lint.

### Usage
```sh
# Lint all the project files.
$ rna lint

# Lint only some files
$ rna lint 'src/index.js' 'src/components/**/*.jsx'

# Lint and fix style errors
$ rna lint 'src/**/*.{css,sass,scss}' --fix
```

### See also

* [`rna build`](../build/)
