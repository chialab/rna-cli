A monorepo project can handle multiple NPM module packages.

## Structure

### The package.json

The package.json file is the manifest of the whole monorepo project.

#### `workspaces`

A list of globs that match sub-projects. The proposed value for this entry is `packages/*`.

#### `private`

Monorepo projects need to be flag as private, in order to prevent unwanted publishing on the NPM registry.

### FileSystem

A monorepo project (generally) has the following structure in the file system:
```sh
# NPM DEPENDENCIES DIRECTORY
/packages         # The base path for sub-projects.

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

To setup a monorepo project with RNA you can run the `rna init` command with the following answers:

```sh
~/ $ rna init module
? package > name: @chialab/module                          # The name of the NPM package
? package > version: 1.0.0                                 # The initial version of the NPM package
? package > description: A NPM module.                     # The description of the NPM package
? package > workspaces: packages/*                         # A glob that matches sub-projects
? package > author: Chialab <dev@chialab.io>               # The author name of the module
? package > license: (MIT)                                 # The license of the module
package.json updated (~/module)
Initialized empty Git repository in ~/module/.git/
? git > remote repository: git@github.com:chialab/module   # The git url for the project
```