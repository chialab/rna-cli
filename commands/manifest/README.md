⚠️  Although the command has been retained for backward compatibility with version 1.0 and 2.0, you really should use the new `rna build` command.

Generate a WebApp [manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest).

### Options

* `--output` The output file name of the manifest. If the output file already exists, it uses it to pre-populate data. If not defined, it tries to create or detect a `manifest.json`.
* `--icon` Select an image to use for web app icons generation. If not defined, it tries to detect an `index.html` file in the path.
* `--index` Select and the index HTML file where to inject the manifest and icons reference.
* `--scope` The [manifest's scope](https://developer.mozilla.org/en-US/docs/Web/Manifest#scope) value.

### Usage
```sh
$ rna manifest public/ --icon resources/icon.png --scope '/'
```

### See also

* [`rna sw`](../sw/)
