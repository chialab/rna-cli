# RNA CLI

> Although the command has been retained for backward compatibility with version 1.0, you really should use the `yarn add` original command instead of this alias.

### Command: `add`

```sh
$ rna add --help

add  Add project dependencies.
     <module1> <module2> <module3>  The modules to add.
     [--dev]                        Add to dev dependencies.
```

This command is an alias to `yarn add` command.

### Options

* `--dev` Install the module as dev dependency.

### Usage
```sh
$ rna add @dnajs/idom
$ rna add eslint --dev
```

### See also

* [`rna install`](../install/)
* [`rna remove`](../remove/)
