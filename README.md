# RNA CLI

A CLI to rule them all.

## Prerequistes

* [Git](https://git-scm.com/)
* [Yarn](https://yarnpkg.com)

## Install
```sh
$ yarn global add @chialab/rna-cli
# or
$ npm install -g @chialab/rna-cli
```

## Usage
```sh
$ rna --help
```

## Docker

RNA is also available as a Docker image on the official Docker Hub.

```bash
$ docker run chialab/rna-cli rna --version
```

## Commands

* **help** - Show CLI help
* **init** - Setup a new project.
* [**install**](./commands/install) - Sync project dependencies. `yarn install` alias.
* [**add**](./commands/add) - Add a project dependency. `yarn add` alias.
* [**remove**](./commands/remove) - Remove a project dependency. `yarn remove` alias.
* **lint** - Lint your source files.
* [**build**](./commands/build) - Build the project.
* **manifest** - Generate webapp manifest.
* **sw** - Generate Service Worker with precached files.
* **serve** - Setup a server for your project.
* **unit** - Run project unit tests.
* **publish** - Publish to NPM.
* **documentation** - Generate API references.
* **start** - `yarn start` alias.
* **run** - `yarn run` alias.
