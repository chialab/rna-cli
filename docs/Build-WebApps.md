Since version 3, RNA is able to accept a HTML file as build input, collecting all referenced assets, building scripts and CSS, generating a webmanifest and all required icons, in order to output a complete WebApp.

```sh
$ rna build src/index.html --output public
```

In a [WebApp project](./Setup-a-WebApp), RNA can automatically detect the file to build using the `lib` field in the package.json, and it will generate outputs to the `directories.public` path.

## Links

Collect all `<link href="...">` and

* if the referenced file is a style, it will perform a [CSS build](./Build-css-modules). Examples:
  * `<link rel="stylesheet" href="index.scss">`
  * `<link href="index.css">`
  * `<link rel="preload" href="index.scss" as="style">`
* if the referenced file is a script, it will perform a [JS build](./Build-js-modules). Examples:
  * `<link rel="preload" href="index.js" as="script">`
* if the referenced file is an icon, [check out below](#icons).
* if the referenced file is a webmanifest, [check out below](#webmanifest).
* if the referenced file is a generic asset, it will be copy along the HTML distribution path.

## Styles

Collect all `<style>` elements and inline `style="..."` attributes and perform a [CSS transpiling](./Build-css-modules#transpiling). Also, al referenced assets will be copy along the HTML distribution path.

## Scripts

Collect all `<script src="..." type="text/javascript">` or inline `<script>` elements and generate an UMD bundle via the [JS build task](./Build-js-modules). If can still use `import` and `export` statements in your scripts, but the bundle will result as a single file (no dynamic imports in production).

## Modules

Since [not all browsers may supports ES modules](https://caniuse.com/#feat=es6-module), `<script src="..." type="module">` elements are collected in order to generate compatible scripts without losing module capabilities, like dynamic imports.

### The ES modules script
A bundle of all scripts with `type="module"` will be generated using the ES module format in the `module` directory for those browsers that support the syntax, and it will be referenced in the document with a `<script src="module/index.m.js" type="module">` node.

### The compatible script
Another bundle will be created using the [SystemJS](https://github.com/systemjs/systemjs) format in the `nomodule` directory and referenced in the HTML with a `<script type="text/javascript" nomodule="">System.import('./nomodule/index.m.js')</script>` node.

Both bundles are generated with a [script build](./Build-js-modules), and collect all required assets and chunks of code. Browsers that support `type="module"` do not load scripts marked with the `nomodule` attribute. Viceversa, non modern browsers does load module scripts, fallbacking to the `nomodule` solution.

**Example**

in:
```html
<script type="module">
    import('./math.js');
</script>
```

out:
```html
<!-- browser supports ESM -->
<script type="module" src="module/index.m.js"></script>

<!-- browser does not support ESM -->
<!-- load the SystemJS library -->
<script type="text/javascript" src="nomodule/s.min.js" nomodule=""></script>
<!-- load the SystemJS module -->
<script type="text/javascript" nomodule="">
    System.import('./nomodule/index.m.js')
</script>
```

**Tips**

If you want to produce only ES6 compatible bundle, you can use the `--targets esmodules` flag. In dev mode, using the `--targets esmodules` flag will decrease first (and incremental) build times.

## Sources

Collect all generic `src="..."` or `href="..."` attributes references, and copy the assets along the HTML distribution path.

## Icons

When a `<link rel="icon" href="...">` has been collected, RNA will generate all icons (starting from the referenced one) required to correctly handle favicons, added to home web apps and splashscreens, adding the requested nodes to the document. For example:

in:
```html
<link rel="icon" href="icon.png" />
```

out:
```html
<link rel="icon" sizes="16x16" href="favicon-16x16.png">
<link rel="icon" sizes="32x32" href="favicon-32x32.png">
<link rel="icon" sizes="192x192" href="favicon-192x192.png">
<link rel="icon" sizes="48x48" href="favicon-48x48.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="167x167" href="apple-touch-icon-ipad.png">
<link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="apple-launch-iphonex.png">
<link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="apple-launch-iphone8.png">
<link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" href="apple-launch-iphone8-plus.png">
<link rel="apple-touch-startup-image" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" href="apple-launch-iphone5.png">
<link rel="apple-touch-startup-image" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" href="apple-launch-ipadair.png">
<link rel="apple-touch-startup-image" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)" href="apple-launch-ipadpro10.png">
<link rel="apple-touch-startup-image" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" href="apple-launch-ipadpro12.png">
```

## Webmanifest

When a `<link rel="manifest" href="...">` has been collected, RNA will update (if the referenced file exists) or create a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest).

RNA will try to fill all missing fields using HTML metadata when available, in order to provide the more completed manifest in the output folder:

* **name**: inherited from the `<title>` node in the HTML
* **description**: inherited from the `<meta name="description">` node
* **scope**: inherited from the `<base>` node
* **theme**: inherited from the `<meta name="theme">` node
* **icons**: generated from the `<link rel="icon" />` node
* **lang**: inherited from the `<html lang="...">` attribute

When the manifest has at least an icon, or this has been passed from the HTML, it will generated all necessary icons for the manifest.

Once the manifest has been created or updated, the following operations will be reflected to the HTML:

* if the document is missing a `<title>`, adds it using the `name` field of the manifest
* if the document is missing a `<meta name="apple-mobile-web-app-title">` adds it using the `name` field
* if the document is missing a `<meta name="description">`, adds it using the `description` field (if provided)
* if the document is missing a `<base>` adds it using the `scope` field (if provided)
* if the document is missing a `<meta name="theme">` adds it using the `theme` field (if provided)
* if the `<html>` node is missing the `lang` attribute set it using the `lang` field

## Service Worker

When Web Manifest has been loaded, the RNA will check for the `serviceWorker` field. If it exists, as a final task, RNA will update (if the `serviceWorker.src` reference exists) or create a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) file, injecting precaching for all generated outputs of the HTML bundler, using the [Workbox](https://developers.google.com/web/tools/workbox/) library.