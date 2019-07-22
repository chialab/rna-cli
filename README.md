# RNA CLI

A CLI to rule them all.

## Requisites

* [Git](https://git-scm.com/)
* [Yarn](https://yarnpkg.com)

## Install
```sh
$ yarn global add @chialab/rna-cli
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

* [**init**](./commands/init) - Setup a new project.
* [**build**](./commands/build) - Build the project.
* [**serve**](./commands/serve) - Setup a server for your project.
* [**lint**](./commands/lint) - Lint your source files.
* [**unit**](./commands/unit) - Run project unit tests.
* [**publish**](./commands/publish) - Publish to NPM.
* [**documentate**](./commands/documentate) - Generate API references.
* [**config**](./commands/config) - Set RNA cli configuration.
