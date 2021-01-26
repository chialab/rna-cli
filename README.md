<p align="center">
    <a href="https://www.chialab.io/p/rna-cli">
        <img alt="RNA logo" width="144" height="144" src="https://raw.githack.com/chialab/rna-cli/master/logo.svg" />
    </a>
</p>

<p align="center">
    <strong>RNA</strong> • A CLI to rule them all.
</p>

<p align="center">
    <a href="https://www.chialab.io/p/rna-cli"><img alt="Documentation link" src="https://img.shields.io/badge/Docs-chialab.io-lightgrey.svg?style=flat-square"></a>
    <a href="https://github.com/chialab/rna-cli"><img alt="Source link" src="https://img.shields.io/badge/Source-GitHub-lightgrey.svg?style=flat-square"></a>
    <a href="https://www.chialab.it"><img alt="Authors link" src="https://img.shields.io/badge/Authors-Chialab-lightgrey.svg?style=flat-square"></a>
    <a href="https://www.npmjs.com/package/@chialab/rna-cli"><img alt="NPM" src="https://img.shields.io/npm/v/@chialab/rna-cli.svg?style=flat-square"></a>
    <a href="https://github.com/chialab/rna-cli/blob/master/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@chialab/rna-cli.svg?style=flat-square"></a>
</p>

---

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
* [**config**](./commands/config) - Set rna cli configuration.

---

## License

RNA is released under the [MIT](https://github.com/chialab/rna-cli/blob/master/LICENSE) license.
