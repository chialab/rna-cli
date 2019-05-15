It uses [ESLint](https://eslint.org/) for JavaScript files and [Stylelint](https://stylelint.io/) for CSS.

Run lint tasks across the projects. It uses ESLint for JavaScript and TypeScript projects and StyleLint for CSS and SCSS files, looking for `.eslintrc.yml` and `.stylelintrc.yml` in the project root and fallbacking to RNA core config files missing. Configuration files and lint runners needs to be saved in the project, in order to provide integration with your IDE (eg VS Code).

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
