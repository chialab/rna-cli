⚠️  Deprecated in v4.0.0, please use Lerna or Standard Version tools.

---

It publishes modules of modules and monorepos NPM, creating a release tag for Git.

If a `lerna.json` is found in the root of the project, it uses [lerna](https://github.com/lerna/lerna) to publish modules.

### Options

* `[version]` Specify the new version (optional).
* `--patch` Deploy a patch version of the package(s).
* `--minor` Deploy a minor version of the package(s).
* `--major` Deploy a major version of the package(s).
* `--alpha` Deploy an alpha version of the package(s).
* `--beta` Deploy a beta version of the package(s).
* `--rc` Deploy a rc version of the package(s).
* `--no-git` Skip Git commit and tag.
* `--no-npm` Skip NPM release.

### Usage
```sh
# Publish a canary version of your monorepo's packages
$ rna publish --canary

# Publish a new version of the packages
$ rna publish 1.2.0

# Prompt a list of versions to choose
$ rna publish

# Publish to NPM only
$ npm publish --no-git
```
