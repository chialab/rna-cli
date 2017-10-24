# RNA CLI

> A CLI to rule them all.

## Install
```sh
$ [sudo] npm install -g git+https://git@gitlab.com/chialab/rna-cli
```

## Usage
```sh
$ rna
```

## Commands

* [x] **help** - Show CLI help
* [ ] **setup** - Setup a new project.
* [x] **add** - Add a project dependency.
* [x] **remove** - Remove a project dependency.
* [x] **bootstrap** - Sync project dependencies.
* [x] **lint** - Lint your source files.
* [x] **build** - Build the project.
* [x] **watch** - Watch project files.
* [x] **serve** - Setup a server for your project.
* [x] **unit** - Run project unit tests.
* [x] **publish** - Publish to NPM.
* [x] **start** - `yarn/npm start` alias
* [x] **run** - `yarn/npm run` alias

## Principles

### Common working directory

Per i comandi che fanno riferimento a un progetto, la `cwd` di riferimento è sempre la root del progetto, identificata dalla presenza del file `package.json` o della cartella `.git`.
La CLI risalse in automatico il file system per identificare la root del progetto.

### Configuration overwrite

Al momento, non supportiamo il merge di configurazioni, ma solo il replacement in toto. Se nel progetto è presente un file di configurazione, questo dovrà essere completo per eseguire lo step, perché la CLI userà solo quello.
Da prevedere un'opzione generica (`--config`) che permetta di individuare il file di configurazione, al momento supportato solo in root.

### Pipelines

Dal momento che alcuni comandi mantengono attivo il processo, non è possibile concatenare i comandi con `&&`, ma è comunque possibile creare una pipeline separando i comandi con `+`. Esempio:

```sh
$ rna watch src/ + serve ./public
```

### Files and packages
Gli argomenti passati ai comandi possono essere file, cartelle e nomi di moduli (nel caso si utilizzi una struttura monorepo).

**Algoritmo di risoluzione**:

`$package` si riferisce al `package.json`.

Progetti semplici:

* `rna [cmd]` (senza argomenti)

        # Esempio: esegue la build del progetto 
        $ rna build

* `rna [cmd] file` (file generico)

        # Esempio: esegue il lint su un singolo file
        $ rna lint /full/path/to/src/demo.js

* `rna [cmd] file dir/` (file multipli)

        # Esempio: attiva il watch sul file e tutta la cartella
        $ rna watch ./src/demo.js ./dist/


Progetti monorepo:

* `rna [cmd]` (senza argomenti)

        # Esempio: pubblica i progetti
        $ rna publish

* `rna [cmd] $package1.name` (singolo progetto)

        # Esempio: testa un progetto
        $ rna unit @chialab/sidenav

* `rna [cmd] $package1.name $package2.name` (progetti multipli)

        # Esempio: esegue la build di più progetti
        $ rna build @chialab/sidenav @chialab/dialog

* `rna [cmd] file` (singolo file)

        # Esempio: esegue la build dell'applicazione e ignora i workspace
        $ rna build app/index.js --output public/app.js

* `rna [cmd] file dir/` (file multiplo)

        # Esempio: crea un server per l'app
        $ rna serve public/ assets/

* `rna [cmd] $package1.name packages/package1/src/index.js dir/` (mix)

        # Esempio: esegue un watch sia sull'app che per i workspace
        $ rna watch src/app.js @chialab/synapse

