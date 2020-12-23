JavaScript (or TypeScript) files typically require a lot of tasks, tools and configurations. RNA aims to provide a configuration-free task for JS distribution build, with a great support for source maps (it can be disabled via the `--no-map` flag).

Example:
```sh
$ rna build src/index.js --output dist/index.js
```

RNA will also minify the code if the flag `--production` is passed, using [Terser](https://github.com/terser-js/terser), a JS minificator with ES6+ support.

In a [module project](./Setup-a-module), RNA can automatically detect the file to build using the `lib` field in the package.json, and it will generate bundles for the `module`, `main` and `browser` fields.

Running the `build` command in a module project
```sh
$ rna build
```
has the same effect of:

```sh
$ rna build path/to/entry.js --output path/to/module/entry.js --format es
$ rna build path/to/entry.js --output path/to/main/entry.js --format cjs
$ rna build path/to/entry.js --output path/to/browser/entry.js --format umd
```

## Transpiling
RNA uses [Babel](https://babeljs.io/) to transpile non-standard ES syntax to the supported one of the project target. It supports private class fields, decorators, JSX, async/await with Promises and all ES2017 features. You can configure the target of build using the `build --targets '<browser list query>'` command.

Babel also converts `require` and `exports` statements to a ES modules compatible syntax, in order to be correctly consumed by Rollup bundler.

All scripts will be transpiled when building JS files.

### JSX
JSX syntax is supported as well, defining pragma via the `--jsx.pragma`, `--jsx.pragmaFrag` and `--jsx.module` (in order to automatically import pragma from the specified module) options. By default, it will automatically use the `@dnajs/idom` module and pragma.

Files with `.jsx` extension can contains only JSX statements, and they will transpiled to an default exported function which returns that statements.

in:
```js
<div>Hello</div>
```
out:
```js
export default function() {
    return h('div', null, 'hello');
}
```

### TypeScript
RNA adds support for TypeScript transpiling for `.ts` and `.tsx` files. It uses the official typescript module, in order to properly run type checking before building.

## Bundling

[Rollup](https://rollupjs.org) is the tool used for bundling ES modules, in order to provide the less possible number of files to load in an application. It resolves dependencies, deletes unreachable code and links external assets.

Rollup can target different module systems, configurable via the `--format <esm|cjs|umd|iife|system>` option. Unless the `--bundle` flag has been passed, when using `esm` and `cjs` format, RNA will bundle only source files, keeping the NPM dependencies in order to prevent duplicates when using common packages. Otherwise, it will collect all dependencies in the bundle file.

### Static imports/exports

Rollup collects files via ES modules syntax.

```js
// default import
import Math from './math.js';
// named imports
import { listen, unlisten } from './events.js';
// namespace import
import * as events from './events.js';

// default export
const Math = {};
export default Math;

// named export
export function listen() {}
export function unlisten() {}
```

### Dynamic imports

Dynamic imports, using the `import()` statement, are collected too, generating chunks when imported file shares dependencies with the importee source.

```js
async function listen() {
    const { listen } = await import('./events.js');
    listen();
}
```

This a useful feature for importing code only when necessary, in an `async` way.

### Web Workers

RNA is able to collect [Web Worker](https://developer.mozilla.org/it/docs/Web/API/Worker) references:

```js
const worker = new Worker('./codec.js');
```

As Dynamic Imports, it will generate a chunk with shared dependencies.

### Chunking

When using a target which supports module lazy import (`esm`, `cjs` and `register`), Rollup can generate chunks of code in order to prevent code duplication: if two (or more) modules, dynamically imported, share a dependency(-ies), Rollup will create a chunk with this dependency(-ies). This is a huge optimisation in order of downloaded bytes in WebApp.

### Module resolution

By spec, files imported in an ES module needs to be relative, but it is common to import NPM dependencies in a NodeJS style, in order to avoid paths conflicts when the module is used as a dependency itself.

```js
// import the entry specified in the package.json of the dependency
import { listen } from '@chialab/events';

// import the given file from a dependency
import { listen } from '@chialab/events/dist/esm/events.js';
```

RNA is able to check and resolve NPM dependencies during the bundle phase. When importing a module without specifying a file, the first existing file matched by the fields `module`, `jsnext`, `main` and `browser` in the dependency package.json will be used. The order of the fields comes for optimisation purposes (generally, the `module` fields indicated a file with ES module syntax).

## Assets

### Import images, fonts and other assets

Scripts can import assets and use a reference url in order to load or manipulate the file.

```js
import IMAGE_URL from './images/batman.png';

const img = new Image();
img.src = IMAGE_URL;
document.body.appendChild(img);
```

Rollup will copy the referenced asset in the `path/to/dist/asset` directory.

### Import JSON files

JSON file imports are converted to plain JS objects, in order to read, traverse and modify entries.

```js
import DEFAULT_CONFIG from './configs/defaults.json';

console.log(typeof DEFAULT_CONFIG); // "object"
export const LANG = DEFAULT_CONFIG.lang;
```

### Import CSS modules

If the imported asset is a CSS file, it will be treat a special module which exports a default [`CSSStyleSheet`](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet), as well as its code and asset url.

```js
import sheet, { code, url } from './style.scss';

console.log(sheet.constructor.name); // CSSStyleSheet
console.log(typeof code); // "string"
console.log(url); // https://localhost:3000/assets/style.css
```

CSS (or SCSS) files will be transpiled and bundled as described in "[Build CSS modules](./Build-css-modules)". Also, assets referenced via the CSS `url('...')` declaration will be collected in the Rollup bundle.

### Import HTML modules

Support for [HTML modules](https://github.com/dglazkov/webcomponents/blob/html-modules/proposals/HTML-Imports-and-ES-Modules.md) is provided too. Similar to the CSS import, it default exports a [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment), along with the code and the asset url.

```js
import fragment, { code, url } from './template.html';

document.body.appendChild(fragment);
```

HTML files import will:
* collect all referenced assets in the file (eg `<img src="batman.jpg" />`)
* build and bundle all CSS or SCSS files as assets
* collect and build all scripts, treating them as chunks of the source in order to share code and dependencies

### Import PO files

Localisation files in `.po` format can be imported in a script. RNA collects all `.po` imported files with same name and produces a single JSON file for each name that can be used, for example, with the [i18next](https://www.i18next.com/) library.

```js
import EN from './locale/en/default.po';
import IT from './locale/it/default.po';

async getLocaleStrings() {
    let response;
    if (/^it\-/i.test(navigator.language) {
        response = await fetch(IT);
    } else {
        response = await fetch(EN);
    }

    return await response.json();
}
```
