A WebApp project is indicated to generate and distribute Web applications.

## Structure

### The package.json

The package.json file is the manifest of the whole project. It contains all informations that RNA can use to build, serve and test the project.

#### `directories.src`

This entry specify the location of the source folder. RNA uses this setting to detect which files needs source maps generation, coverage reports and linting. The proposed value for this entry is `src`.

#### `directories.test`

This represent the root path for test files. When no arguments are passed to the `unit` command, RNA uses this folder to search for specs. The proposed value for this entry is `test`.

#### `directories.public`

This is the distribution path for the `build` task, and the base path served by the `serve` command. The proposed value for this entry is `public`.

#### `lib`

The entry source file for the module. When running `build` without arguments, RNA uses this file to build and bundle the whole project into the `directories.public` path. The proposed value for this entry is `src/index.html`.

### FileSystem

A WebApp project (generally) has the following structure in the file system:
```sh
# NPM DEPENDENCIES DIRECTORY
/node_modules     # Where npm/yarn stores project dependencies. IGNORED in git.

# SOURCE FILES
/src              # The source path referenced by `directories.src`. IGNORED when publishing to NPM.
  /index.html     # The source file entry referenced by `lib`.

# DISTRIBUTION FILES
/public           # The distribution path. IGNORED in git. 
  /index.html

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
```

## Setup

To setup a WebApp project with RNA you can run the `rna init` command with the following answers:

```sh
~/ $ rna init module
? package > name: @chialab/module                          # The name of the NPM package
? package > version: 1.0.0                                 # The initial version of the NPM package
? package > description: A NPM module.                     # The description of the NPM package
? package > workspaces:                                    # Leave empty
? package > base src path: src                             # The base path for the source files
? package > source file entry: src/index.html              # The entry point for the module
? package > base test path: test                           # The base path for test specs
? package > es module point                                # Leave empty
? package > cjs module entry point                         # Leave empty
? package > browser module entry point                     # Leave empty
? package > public path: public                            # The public path
? package > author: Chialab <dev@chialab.io>               # The author name of the module
? package > license: (MIT)                                 # The license of the module
package.json updated (~/module)
Initialized empty Git repository in ~/module/.git/
? git > remote repository: git@github.com:chialab/module   # The git url for the project
```