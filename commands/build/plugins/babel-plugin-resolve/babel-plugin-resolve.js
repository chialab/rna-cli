const fs = require('fs');
const path = require('path');
const resolve = require('resolve');

/**
 * Detect relative paths (strings which start with './' or '../')
 * @type {RegExp}
 * @private
 */
const RELATIVE_PATH = /^\.+\//;

/**
 * Check if a path is in the include/exclude list.
 * @private
 *
 * @param {Array<string|RegExp|Function>} list List of exclusion rules.
 * @param {string} fileName The path to check.
 * @return {Boolean}
 */
function filter(list, fileName) {
    return !!list.find((rule) => {
        if (typeof rule === 'string') {
            return rule === fileName;
        }
        if (rule instanceof RegExp) {
            return rule.test(fileName);
        }
        if (typeof rule === 'function') {
            return rule(fileName);
        }
    });
}

/**
 * Babel plugin for import and export source replacements with relative path in `node_modules`.
 */
function importResolve({ types }) {
    /**
     * Cache module imports.
     * @type {Object}
     * @private
     */
    const CACHE = {};

    /**
     * Check for source to replace.
     * @private
     *
     * @param {ImportDeclaration} importDecl The ast node to update.
     * @param {State} state The plugin state.
     * @return {void}
     */
    function handleSource(importDecl, state) {
        const filename = importDecl.hub.file.opts.filename;
        const dirname = path.dirname(filename);
        const opts = state.opts;
        const include = opts.include || [];
        const exclude = opts.exclude || [];
        const source = importDecl.get('source');
        if (!source || !source.node) {
            // local `export`
            return;
        }
        let value = source.node.value;
        if (include.length && !filter(include, value)) {
            // excluded by plugin options
            return;
        }
        if (exclude.length && filter(exclude, value)) {
            // excluded by plugin options
            return;
        }
        if (resolve.isCore(value)) {
            // core nodejs modules
            return;
        }
        if (RELATIVE_PATH.test(value)) {
            value = path.resolve(dirname, value);
            if (fs.existsSync(value)) {
                let stats = fs.statSync(value);
                if (stats.isDirectory()) {
                    let pkg = path.join(value, 'package.json');
                    if (fs.existsSync(pkg)) {
                        value = require(pkg).name;
                    } else {
                        value = path.join(value, 'index.js');
                    }
                }
            }
        }
        try {
            // try to detect module name
            let parts = value.split(/[/\\]/);
            let modName = parts.shift();
            if (modName[0] === '@') {
                // scope module
                modName += `/${parts.shift()}`;
            }
            if (parts.length) {
                // file request
                value = resolve.sync(value, { basedir: dirname });
                if (fs.existsSync(value)) {
                    let stats = fs.statSync(value);
                    if (stats.isDirectory()) {
                        value = path.join(value, 'index.js');
                    }
                }
            } else {
                // module request
                let pkgName = resolve.sync(`${modName}/package.json`, { basedir: dirname });
                let pkg = require(pkgName);
                let found = false;
                if (CACHE[modName]) {
                    value = CACHE[modName];
                    found = true;
                }
                // handle `module` field
                if (opts.module !== false && pkg.hasOwnProperty('module') && !found) {
                    value = resolve.sync(`${modName}/${pkg.module}`, { basedir: dirname });
                    found = fs.existsSync(value);
                }
                // handle `jsnext:main` field
                if (opts.jsNext !== false && pkg.hasOwnProperty('jsnext:main') && !found) {
                    value = resolve.sync(`${modName}/${pkg['jsnext:main']}`, { basedir: dirname });
                    found = fs.existsSync(value);
                }
                // handle `main` field
                if (opts.main !== false && pkg.hasOwnProperty('main') && !found) {
                    value = resolve.sync(`${modName}/${pkg.main}`, { basedir: dirname });
                    found = fs.existsSync(value);
                }
                if (!found) {
                    value = resolve.sync(`${modName}/index.js`, { basedir: dirname });
                    found = fs.existsSync(value);
                }
                if (found) {
                    CACHE[modName] = value;
                }
            }
            value = path.relative(dirname, value);
            if (value[0] !== '.') {
                value = `./${value}`;
            }
            source.replaceWith(
                types.stringLiteral(value)
            );
        } catch (err) {
            //
        }
    }

    return {
        visitor: {
            // handle `import` and `export` statements
            ImportDeclaration: handleSource,
            ExportDeclaration: handleSource,
        },
    };
}

module.exports = importResolve;
