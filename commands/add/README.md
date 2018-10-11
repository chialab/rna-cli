# RNA CLI

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
```
$ rna add @dnajs/idom
$ rna add eslint --dev
```

### See also

* [`rna install`](../install/)
* [`rna remove`](../remove/)
