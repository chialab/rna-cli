const fs = require('fs');
const path = require('path');

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
 * Check if module is core.
 * @private
 *
 * @param {string} name The module name/
 * @return {Boolean}
 */
function isCore(name) {
    try {
        if (require.resolve(name) === name) {
            // core nodejs modules
            return true;
        }
    } catch (err) {
        //
    }
    return false;
}

/**
 * Cache module imports.
 * @type {Object}
 * @private
 */
const CACHE = {};

/**
 * Babel plugin for import and export source replacements with relative path in `node_modules`.
 */
function importResolve({ types }) {
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
        const nodeModules = [dirname].concat(opts.modulesPaths || []);
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
        try {
            if (RELATIVE_PATH.test(value)) {
                value = require.resolve(value, { paths: nodeModules });
            } else {
                if (isCore(value)) {
                    // core nodejs modules
                    return;
                }
                // try to detect module name
                let parts = value.split(/[/\\]/);
                let modName = parts.shift();
                if (modName[0] === '@') {
                    // scope module
                    modName += `/${parts.shift()}`;
                }
                if (parts.length) {
                    // file request
                    value = require.resolve(value, { paths: nodeModules });
                } else {
                    // module request
                    let pkgName = require.resolve(`${modName}/package.json`, { paths: nodeModules });
                    if (!pkgName) {
                        return;
                    }
                    if (CACHE[pkgName]) {
                        value = CACHE[pkgName];
                    } else {
                        let pkgDirname = path.dirname(pkgName);
                        let pkg = JSON.parse(fs.readFileSync(pkgName));
                        let found = false;
                        // handle `module` field
                        if (opts.module !== false && pkg.hasOwnProperty('module') && !found) {
                            value = require.resolve(path.join(pkgDirname, pkg.module));
                            found = !!value;
                        }
                        // handle `jsnext:main` field
                        if (opts.jsNext !== false && pkg.hasOwnProperty('jsnext:main') && !found) {
                            value = require.resolve(path.join(pkgDirname, pkg['jsnext:main']));
                            found = !!value;
                        }
                        // handle `main` field
                        if (opts.main !== false && pkg.hasOwnProperty('main') && !found) {
                            value = require.resolve(path.join(pkgDirname, pkg.main));
                            found = !!value;
                        }
                        if (!found) {
                            value = require.resolve(pkgDirname);
                            found = !!value;
                        }
                        if (found) {
                            CACHE[pkgName] = value;
                        }
                    }
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
