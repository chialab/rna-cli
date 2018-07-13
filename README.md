# RNA CLI

A CLI to rule them all.

## Install
```sh
$ npm install -g @chialab/rna-cli
# or
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

* **help** - Show CLI help
* **setup** - Setup a new project.
* **install** - Sync project dependencies.
* **add** - Add a project dependency.
* **remove** - Remove a project dependency.
* **lint** - Lint your source files.
* **build** - Build the project.
* **manifest** - Generate webapp manifest.
* **sw** - Generate Service Worker with precached files.
* **watch** - Watch project files.
* **serve** - Setup a server for your project.
* **unit** - Run project unit tests.
* **publish** - Publish to NPM.
* **documentation** - Generate API references.
* **start** - `yarn/npm start` alias.
* **run** - `yarn/npm run` alias.
* **upgrade** - Update the CLI.

## Principles

### Common working directory

Commands which refere to the project use as `cwd` the path to the `package.json` file or `.git` folder.

RNA automatically walk the file system to identify the proejct root.

Othwerwise, the it uses the current terminal `cwd`.

### Zero configuration

You do not need to configure any tool like Babel or Rollup or Karma. RNA just extracts informations by the `package.json`.

### Pipelines

Commands which mantain an active process can be concatened in a pipeline using the `+` char. E.g:

```sh
$ rna build src/ --watch + serve ./public
```

### Files and packages
Command's arguments can refer to files, folders and sub modules (monorepo structure).

**Resolution algorithm**:

`$package` refers to `package.json`.

Simple project structure:

* `rna [cmd]` (no arguments)

        # Exec project build
        $ rna build

* `rna [cmd] file` (file entrypoint)

        # Lint a single file
        $ rna lint /full/path/to/src/demo.js

* `rna [cmd] file dir/` (multi entrypoints)

        # Watch a file and a folder
        $ rna watch ./src/demo.js ./dist/


Monorepo structure:

* `rna [cmd]` (no arguments)

        # publish all the packages
        $ rna publish

* `rna [cmd] $package.name` (single module)

        # Exec unit tests for a single module
        $ rna unit @chialab/sidenav

* `rna [cmd] $package1.name $package2.name` (multiple modules)

        # Build multiple modules
        $ rna build @chialab/sidenav @chialab/dialog

* `rna [cmd] $package1.name packages/package1/src/index.js dir/` (mixed mode)

        # Watch workspace modules and single file
        $ rna watch src/app.js @chialab/synapse

