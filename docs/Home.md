Welcome to the **RNA** cli wiki!

RNA is a CLI for Web and NPM projects management. It collects and configures a lot of awesome tools like [Git](https://git-scm.com/), [NPM](https://www.npmjs.com/), [Editorconfig](https://editorconfig.org/), [Babel](https://babeljs.io/), [PostCSS](https://postcss.org/), [Rollup](https://rollupjs.org/), [Karma](https://karma-runner.github.io), [Mocha](https://mochajs.org/), [Chai](https://www.chaijs.com/), [ESLint](https://eslint.org/), [StyleLint](https://stylelint.io/), [Lerna](https://github.com/lerna/lerna) and many others.

## Commands

### `init`

Setup or update a new project, providing configurations for editorconfig, linters, git and npm. Project can be a NPM module, a Web App or a monorepo of NPM modules.

* [How to setup a module project](./Setup-a-module)
* [How to setup a Web App project](./Setup-a-WebApp)
* [How to setup a monorepo project](./Setup-a-monorepo)

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/init)

---

### `build`

Build and bundle project files for distribution.

* [Build JS modules](./Build-js-modules)
* [Build CSS modules](./Build-css-modules)
* [Build Web Apps](./Build-WebApps)
* [Build monorepos](./Build-monorepos)

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/build)

---

### `serve`

Setup a development server with JavaScript and CSS livereload, external tunnel through [localtunnel](https://github.com/localtunnel/localtunnel) and HTTPS support.

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/serve)

---

### `lint`

Run lint tasks across the projects. It uses ESLint for JavaScript and TypeScript projects and StyleLint for CSS and SCSS files, looking for `.eslintrc.yml` and `.stylelintrc.yml` in the project root and fallbacking to RNA core config files missing. Configuration files and lint runners needs to be saved in the project, in order to provide integration with your IDE (eg VS Code).

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/lint)

---

### `unit`

Run unit and e2e tests in Node and Browser environments, using Mocha as test framework and Chai as assertion library. Tests in the browsers are launched by Karma.

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/unit)

---

### `publish`

It publishes modules of modules and monorepos NPM, creating a release tag for Git.  
If a `lerna.json` is found in the root of the project, it uses [lerna](https://github.com/lerna/lerna) to publish modules.

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/publish)

---

### `documentate`

Generate API references for a module in Markdown format, using [dts-apigen](https://github.com/chialab/dts-apigen).

[Usage](https://github.com/chialab/rna-cli/tree/master/commands/documentate)

---