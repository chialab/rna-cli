# RNA CLI

### Command: `publish`

```sh
$ rna publish --help

publish  Publish to NPM.
         [--canary]  Deploy a canary version of the packages.
         [--no-git]  Do not commit version changes to Git.
         [--no-npm]  Do not commit version changes to NPM.
```

It uses [lerna](https://github.com/lerna/lerna) for monorepo's packages release to NPM.

### Options

* `--canary` Publish a canary version of the packages using incremental patch number and commit hash.
* `--no-git` Skip Git commit and tag (NPM only release).
* `--no-npm` Skip NPM release (Git tag only).

### Usage
```sh
# Publish a canary version of your monorepo's packages
$ rna publish --canary

# Publish a new version of the packages
$ rna publish

# Publish a single package (just use npm)
$ npm publish
```
