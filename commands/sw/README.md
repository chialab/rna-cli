⚠️  Although the command has been retained for backward compatibility with version 1.0 and 2.0, you really should use the new `rna build` command.

This command uses [workbox](https://developers.google.com/web/tools/workbox/) by Google to generate a Service Worker with precached files.

## Options
* `--output` The output file name of the [Service Worker](https://developers.google.com/web/fundamentals/primers/service-workers/). If not defined, it tries to create or detect a `service-worker.js` file in the path. If the output already exists, it just update the list of files to cache.
* `--exclude` By default, the command scan the path directory and cache all files it finds. You can exclude some files from the cache using a glob pattern.
* `--watch` Enable the watch mode on the path in order to update Service Worker cache every time an element has changed.

### Usage
```sh
$ rna sw public/ --exclude 'articles/**/*.png'
```

### See also

* [`rna manifest`](../manifest/)
