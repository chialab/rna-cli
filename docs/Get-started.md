## Requisites

* [Git](https://git-scm.com/)
* [Yarn](https://yarnpkg.com)

### Why Yarn?

Yarn is a package manager like NPM, with a core support for [monorepos](https://yarnpkg.com/blog/2017/08/02/introducing-workspaces/). Yarn automatically links packages in the monorepo when installing dependencies, making the workflow easier and less painful. In the future, RNA will be able to work with NPM and Yarn alternately, "but today is not that day".

## Install
```sh
$ yarn global add @chialab/rna-cli
```

## Docker

RNA is also available as a Docker image on the official Docker Hub.

```bash
$ docker run chialab/rna-cli rna --version
```