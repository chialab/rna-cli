It uses [lerna](https://github.com/lerna/lerna) to publish modules of a monorepo to NPM, creating a release tag for Git. Support for plain module is missing at the moment.

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
