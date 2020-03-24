A module project is indicated for JS libraries and/or NPM modules.

## Structure

### The package.json

The package.json file is the manifest of the whole project.

#### `directories.src`

This entry specify the location of the source folder. RNA uses this setting to detect which files needs source maps generation, coverage reports and linting. The proposed value for this entry is `src`.

#### `directories.test`

This represent the root path for test files. When no arguments are passed to the `unit` command, RNA uses this folder to search for specs. The proposed value for this entry is `test`.

#### `lib`

The entry source file for the module. When running `build` without arguments, RNA uses this file to build and bundle the whole project. Distribution files are specified by `module`, `main` and `browser`. The proposed value for this entry is `src/index.js`.

#### `module`

The distribution file that uses ES-style `import` and `exports`. This file is generally used in modern browsers environments or in ES6 NPM modules and does NOT include project dependencies. The source file will be bundled with Rollup using ES format to this path. The proposed value for this entry is `dist/esm/[[name]].js`.

#### `main`

The distribution file that uses CommonJS-style `require` and `module.exports`. This file is generally used in Node environment and does NOT include project dependencies. The source file will be bundled with Rollup using CJS format to this path. The proposed value for this entry is `dist/cjs/[[name]].js`.

#### `browser`

The distribution file that uses UMD format. This file is generally used in browser environments and bundles all project dependencies. The source file will be bundled with Rollup using UMD format to this path. The proposed value for this entry is `dist/umd/[[name]].js`.

#### `types`

This entry is used by TypeScript (and its IDE extensions) to load typings for the module and provide intellisense support when importing it. If specified, RNA will automatically generate the `.d.ts` file for the module in that position. The proposed value for this entry is `dist/[[name]].d.ts`.

### FileSystem

A module project (generally) has the following structure in the file system:
```sh
# NPM DEPENDENCIES DIRECTORY
/node_modules     # Where npm/yarn stores project dependencies. IGNORED in git.

# SOURCE FILES
/src              # The source path referenced by `directories.src`. IGNORED when publishing to NPM.
  /index.js       # The source file entry referenced by `lib`.

# DISTRIBUTION FILES
/dist             # The distribution path. IGNORED in git. 
  /esm/module.js  # The esm entry file referenced by `module`.
  /cjs/module.js  # The cjs entry file referenced by `main`.
  /umd/module.js  # The umd entry file referenced by `browser`.
  /module.d.ts    # The tyepings entry file referenced by `types`.

# TEST FILES
/test             # The test path referenced by `directories.test`. IGNORED when publishing to NPM.
  /test.spec.js

# NPM/YARN STUFF
package.json

# MARKDOWN FILES
README.md
LICENSE

# CONFIGURATION FILES
.editorconfig     # Store the editorconfig configuration.
.eslintrc.yml     # Store ESLint configuration and rules.
.eslintignore     # Specify a list of files that need to be ignored by ESLint.
.stylelintrc.yml  # Store Stylelint configuration and rules.
.stylelintignore  # Specify a list of files that need to be ignored by Stylelint.
.gitignore        # The list of files that Git should ignore.
.npmignore        # The list of files that should not be published to NPM.
```

## Setup

To setup a module project with RNA you can run the `rna init` command with the following answers:

```sh
~/ $ rna init module
? package > name: @chialab/module                          # The name of the NPM package
? package > version: 1.0.0                                 # The initial version of the NPM package
? package > description: A NPM module.                     # The description of the NPM package
? package > workspaces:                                    # Leave empty
? package > base src path: src                             # The base path for the source files
? package > source file entry: src/index.js                # The entry point for the module
? package > base test path: test                           # The base path for test specs
? package > es module point: dist/esm/module.js            # The distribution file with ES-style exports
? package > cjs module entry point: dist/cjs/module.js     # The distribution file with CommonJS-style exports
? package > browser module entry point: dist/umd/module.js # The distribution file for browser
? package > types entry point: dist/module.d.ts            # The typings declaration file for the module
? package > author: Chialab <dev@chialab.io>               # The author name of the module
? package > license: (MIT)                                 # The license of the module
package.json updated (~/module)
Initialized empty Git repository in ~/module/.git/
? git > remote repository: git@github.com:chialab/module   # The git url for the project
```