# RNA CLI

### Command: `manifest`

```sh
$ rna manifest --help

manifest  Generate webapp Manifest.
          <path>     The webapp path.
          --output   Where to save the generated manifest.
          [--icon]   The path of the main icon to generate.
          [--index]  Path to the index.html to update.
          [--scope]  Force manifest scope.
```

### Options

* `--output` The output file name of the [manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest). If the output file already exists, it uses it to pre-populate data. If not defined, it tries to create or detect a `manifest.json`.
* `--icon` Select an image to use for web app icons generation. If not defined, it tries to detect an `index.html` file in the path.
* `--index` Select and the index HTML file where to inject the manifest and icons reference.
* `--scope` The [manifest's scope](https://developer.mozilla.org/en-US/docs/Web/Manifest#scope) value.

### Usage
```sh
$ rna manifest public/ --icon resources/icon.png --scope '/'
```

### See also

* [`rna sw`](../sw/)
