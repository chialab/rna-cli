RNA can build every project in a [monorepo](./Setup-a-monorepo):

```sh
$ rna build
```

This will walk across al workspaces specified in the package.json, performing a [module build](./Build-js-modules) for each package. In order to speed up the process, RNA keeps a cache in memory for each build, sharing already handled dependencies.