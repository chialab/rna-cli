const { statSync, existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync, openSync, readSync, closeSync, moveSync, copySync, unlinkSync, rmdirSync, promises: { realpath } } = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');
const gzipSize = require('gzip-size');
const chokidar = require('chokidar');
const { keypath } = require('@chialab/proteins');
const inquirer = require('inquirer');
const PackageManager = require('./PackageManager');
const Git = require('./Git');

/**
 * @typedef {Object} FileSize
 * @property {number} size The original size.
 * @property {number} zipped The gzipped size.
 */

/**
 * Prettify byte size.
 *
 * @param {number} size The file size in bytes.
 * @return {string} The size with the correct unit.
 */
function prettyBytes(size) {
    size = Math.abs(size);

    const KILO = 1024;
    const MEGA = KILO ** 2;
    const TERA = KILO ** 3;

    if (size > TERA) {
        return `${(size / TERA).toFixed(1)} TB`;
    }
    if (size > MEGA) {
        return `${(size / MEGA).toFixed(1)} MB`;
    }
    if (size > KILO) {
        return `${(size / KILO).toFixed(1)} KB`;
    }
    return `${size} B`;
}

/**
 * List of javascript extensions.
 * - javascript
 * - jsx
 * - javascript module
 * - typescript
 * @type {Array<string>}
 */
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];

/**
 * List of style extensions.
 * - css
 * - sass
 * - scss
 * @type {Array<string>}
 */
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass'];

/**
 * List of HTML extensions.
 * - html
 * - htm
 * @type {Array<string>}
 */
const HTML_EXTENSIONS = ['.html', '.htm'];

/**
 * List of WebManifest extensions.
 * - webmanifest
 * @type {Array<string>}
 */
const WEBMANIFEST_EXTENSIONS = ['.webmanifest'];

/**
 * Check if file is a javascript file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isJSFile(file) {
    return JS_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a style file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isStyleFile(file) {
    return STYLE_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a HTML file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isHTMLFile(file) {
    return HTML_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * Check if file is a webmanifest file.
 * @param {string} file The file to check.
 * @return {boolean}
 */
function isWebManifestFile(file) {
    return WEBMANIFEST_EXTENSIONS.indexOf(path.extname(file)) !== -1;
}

/**
 * @class Entry
 * A file reference with some utils methods.
 * @property {string} path The file path.
 */
class Entry {
    /**
     * Create a Entry.
     * @param {string} file The absolute file path.
     * @return {Entry}
     */
    constructor(file) {
        this.path = file;
    }

    /**
     * The file basename.
     * @type {string}
     */
    get name() {
        return path.basename(this.path);
    }

    /**
     * The file name without extname.
     * @type {string}
     */
    get basename() {
        return path.basename(this.path, this.extname);
    }

    /**
     * The file basename.
     * @type {string}
     */
    get extname() {
        return path.extname(this.path);
    }

    /**
     * The file dirname.
     * @type {string}
     */
    get dirname() {
        if (this.path === '/') {
            return null;
        }
        return path.dirname(this.path);
    }

    /**
     * The file size.
     * @type {FileSize}
     */
    get size() {
        let sizes = {
            size: new Number(statSync(this.path).size),
            zipped: new Number(gzipSize.fileSync(this.path)),
        };

        function bytesToString() {
            let value = parseInt(Number.prototype.toString.call(this));
            return prettyBytes(value);
        }

        sizes.size.toString = bytesToString;
        sizes.zipped.toString = bytesToString;

        return sizes;
    }

    /**
     * The file local path relative to project.
     * @type {string}
     */
    get localPath() {
        let project = this.project;
        if (project) {
            return path.relative(project.path, this.path);
        }
        return this.path;
    }

    /**
     * The parent directory reference.
     * @type {Directory}
     */
    get parent() {
        if (!this.dirname) {
            return null;
        }
        return new Directory(this.dirname);
    }

    /**
     * The NPM project of the file.
     * @type {Project}
     */
    get project() {
        let projectPath = this;
        if (projectPath instanceof File) {
            projectPath = projectPath.parent;
        }
        let packageJsonFile;
        while (projectPath) {
            if (projectPath instanceof Project) {
                return projectPath;
            }
            packageJsonFile = projectPath.file('package.json');
            if (packageJsonFile.exists()) {
                return new Project(projectPath.path);
            }
            projectPath = projectPath.parent;
        }
        return null;
    }

    /**
     * Get a path relative to the file reference.
     * @param {string|Entry} file The relative file.
     * @return {string} The relative file path.
     */
    relative(file) {
        if (file instanceof Entry) {
            file = file.path;
        }
        return path.relative(this.path, file);
    }

    /**
     * Check if the reference is a file.
     * @return {boolean}
     */
    isFile() {
        return statSync(this.path).isFile();
    }

    /**
     * Check if the reference is a directory.
     * @return {boolean}
     */
    isDirectory() {
        return statSync(this.path).isDirectory();
    }

    /**
     * Check if the reference exists.
     * @return {boolean}
     */
    exists() {
        return existsSync(this.path);
    }

    /**
     * Remove the file if exists.
     * @return {void}
     */
    unlink() {
        return;
    }

    /**
     * Change file extension.
     * @param {string} ext The new extension.
     * @return {void}
     */
    ext(ext) {
        return this.rename(`${this.basename}${ext}`, false);
    }

    /**
     * Rename the file.
     * @param {string} name The new name.
     * @return {void}
     */
    rename(name, move = true) {
        let dest = path.join(this.dirname, name);
        let clone = new this.constructor(dest);
        if (this.exists() && move) {
            this.move(clone);
        }
        return clone;
    }

    /**
     * Copy a file to a new position.
     */
    copy(to) {
        if (to instanceof Entry) {
            to = to.path;
        }
        copySync(this.path, to, {
            overwrite: true,
        });
    }

    /**
     * Move a file to a new position.
     */
    move(to) {
        if (to instanceof Entry) {
            to = to.path;
        }
        moveSync(this.path, to, {
            overwrite: true,
        });
        this.path = to;
    }
}

/**
 * @class File
 * @extends Entry
 * A Entry which represent a File.
 */
class File extends Entry {
    /**
     * The map file reference for the current file.
     * @type {File}
     */
    get mapFile() {
        return this.ext(`${this.extname}.map`);
    }

    /**
     * The md5 hash of the file.
     * @return {string}
     */
    get hash() {
        const BUFFER_SIZE = 8192;
        const fd = openSync(this.path, 'r');
        const hash = crypto.createHash('md5');
        const buffer = Buffer.alloc(BUFFER_SIZE);

        try {
            let bytesRead;
            do {
                bytesRead = readSync(fd, buffer, 0, BUFFER_SIZE);
                hash.update(buffer.slice(0, bytesRead));
            } while (bytesRead === BUFFER_SIZE);
        } finally {
            closeSync(fd);
        }

        return hash.digest('hex');
    }

    /**
     * @inheritdoc
     */
    unlink() {
        if (!this.exists()) {
            return;
        }
        unlinkSync(this.path);
    }

    /**
     * Read file content.
     * @return {string}
     */
    read() {
        try {
            return readFileSync(this.path, 'utf8');
        } catch (err) {
            return null;
        }
    }

    /**
     * Write file content.
     * @param {string} content The content to write.
     * @return {void}
     */
    write(content) {
        this.parent.ensure();
        writeFileSync(this.path, content);
    }

    /**
     * Read file content as JSON.
     * @return {Object}
     */
    readJson() {
        let data = this.read();
        if (data) {
            data = JSON.parse(data);
        }
        return data;
    }

    /**
     * Write file content as JSON.
     * @param {Object} data The JSON to write.
     * @return {void}
     */
    writeJson(data) {
        this.write(JSON.stringify(data, null, 2));
    }
}

/**
 * @class Directory
 * @extends Entry
 * A Entry which represent a Directory.
 */
class Directory extends Entry {
    /**
     * @inheritdoc
     */
    unlink() {
        if (!this.exists()) {
            return;
        }
        this.empty();
        rmdirSync(this.path);
    }

    /**
     * Ensure the directory to exists.
     * @return {void}
     */
    ensure() {
        mkdirSync(this.path, { recursive: true });
    }

    /**
     * Empty the directory.
     * @return {void}
     */
    empty() {
        this.children().forEach((child) => {
            child.unlink();
        });
    }

    /**
     * Resolve glob patterns relative to the directory.
     * @param {Array<string>|string} patterns Glob patterns.
     * @return {Array<File|Directory>} A list of resolved entries.
     */
    resolve(patterns) {
        let files = [];
        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }

        patterns.forEach((pattern) => {
            glob.sync(pattern, {
                cwd: this.path,
                absolute: true,
            }).forEach((file) => {
                if (!files.includes(file)) {
                    files.push(file);
                }
            });
        });

        return files.map((file) => {
            const stats = statSync(file);
            if (stats.isDirectory()) {
                return new Directory(file);
            }
            if (stats.isFile()) {
                return new File(file);
            }
            return null;
        }).filter(Boolean);
    }

    /**
     * Get a child entry for the directory.
     * @param {string} file The child reference path.
     * @return {Entry}
     */
    entry(file) {
        if (file instanceof Entry) {
            file = file.path;
        }
        return new Entry(path.resolve(this.path, file));
    }

    /**
     * Get a child file for the directory.
     * @param {string} file The child file path.
     * @return {File}
     */
    file(file) {
        if (file instanceof Entry) {
            file = file.path;
        }
        return new File(path.resolve(this.path, file));
    }

    /**
     * Get a child directory for the directory.
     * @param {string} directory The child directory path.
     * @return {Directory}
     */
    directory(directory) {
        if (directory instanceof Entry) {
            directory = directory.path;
        }
        return new Directory(path.resolve(this.path, directory));
    }

    /**
     * Get directory children entries list.
     * @return {Array<File|Directory>}
     */
    children() {
        if (!this.exists()) {
            return [];
        }

        let children = readdirSync(this.path);
        return children.map((file) => {
            let entry = this.entry(file);
            if (entry.isDirectory()) {
                return this.directory(file);
            }
            return this.file(file);
        });
    }

    /**
     * Get directory children files list.
     * @return {Array<File>}
     */
    files() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isFile());
    }

    /**
     * Get directory children directories list.
     * @return {Array<Directory>}
     */
    directories() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isDirectory());
    }

    /**
     * Watch a directory.
     * @param {Function} callback The callback to invoke when a file is changed.
     * @return {Watcher}
     */
    watch(options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = null;
        }
        const hashesMap = new Map();
        const { ignore: ignoreRules } = options || {
            ignore: /\/?\./,
        };

        const shouldIgnore = function(entry) {
            const rules = Array.isArray(ignoreRules) ? ignoreRules : [ignoreRules];
            return rules.some((ignoreRule) => {
                if (ignoreRule instanceof RegExp) {
                    return ignoreRule.test(entry.path);
                }
                if (typeof ignoreRule === 'function') {
                    return ignoreRule(entry);
                }
                return false;
            });
        };

        return chokidar.watch(this.path, {
            ignoreInitial: true,
            recursive: true,
            followSymlinks: true,
        }).on('change', async (fileName) => {
            fileName = await realpath(fileName);
            let entry = this.entry(fileName);
            if (shouldIgnore(entry)) {
                return;
            }
            let eventType = 'change';
            if (!entry.exists()) {
                eventType = 'unlink';
                hashesMap.delete(entry.path);
            } else if (entry.isDirectory()) {
                entry = this.directory(fileName);
            } else {
                entry = this.file(fileName);
                const hash = entry.hash;
                // Check that the file is already changed.
                if (hashesMap.get(entry.path) === hash) {
                    return;
                }
                // update the hash map.
                hashesMap.set(entry.path, hash);
            }
            callback(eventType, entry);
        });
    }
}

/**
 * @class Project
 * @extends Directory
 * A Node project reference.
 */
class Project extends Directory {
    /**
     * Create a new project reference.
     * @param {string} root The root of the project.
     * @return {Project}
     */
    constructor(root) {
        super(root);
        // instantiate a package manager instance for project.
        this.packageManager = new PackageManager(root);
        // create a reference to the package.json file.
        this.packageJson = this.file('package.json');
        // load package.json if exists.
        if (this.packageJson.exists()) {
            this.load();
        } else {
            // setup a new project using root base name.
            this.json = {
                name: path.basename(root).toLowerCase().replace(/\s+/g, '_'),
            };
        }

        // git client instance
        this.git = new Git(root);

        this.setupDirectories();
        this.setupWorkspaces();
    }

    /**
     * Get the name of the scope (for scoped packages).
     * @type {string}
     */
    get scopeName() {
        return this.get('name').split('/').shift().toLowerCase();
    }

    /**
     * Get the name of the module (for scoped packages).
     * @type {string}
     */
    get scopeModule() {
        return this.get('name').split('/').pop().toLowerCase();
    }

    /**
     * Check if project has not been created yet.
     * @type {boolean}
     */
    get isNew() {
        return !this.packageJson.exists();
    }

    /**
     * The parent Project reference if in workspace.
     * @type {Project}
     */
    get parent() {
        let paths = path.dirname(this.path).split(path.sep);
        while (paths.length) {
            paths.pop();
            let superProject = new Project(paths.join(path.sep));
            if (superProject.isNew) {
                // current directory is not a Project.
                continue;
            }
            let workspaces = superProject.workspaces;
            if (!workspaces) {
                // current Project has not workspaces.
                break;
            }
            if (!workspaces.some((ws) => ws.path === this.path)) {
                // the context project is not a workspace of the current Project.
                break;
            }
            // The current Project is the parent of the context one.
            return superProject;
        }
        return null;
    }

    /**
     * Get directories references from `directories` field in package.json.
     * @private
     * @return {void}
     */
    setupDirectories() {
        let config = this.get('directories') || {};
        let directories = {};
        for (let key in config) {
            directories[key] = this.directory(config[key]);
        }
        this.directories = directories;
    }

    /**
     * Get workspaces Project references if Project is monorepo.
     * @private
     * @return {void}
     */
    setupWorkspaces() {
        const workspaces = this.get('workspaces');
        if (!workspaces) {
            // the current project is not a monorepo.
            return null;
        }
        const directories = [];
        // find workspaces roots.
        workspaces.forEach((ws) => {
            directories.push(...super.resolve(ws, false));
        });
        // transform directories into projects.
        const wss = directories
            .filter((entry) => entry instanceof Directory)
            .map((entry) => new Project(entry.path));

        const names = wss.map((ws) => ws.get('name'));
        const dependentMap = {};
        wss.forEach((ws) => {
            const name = ws.get('name');
            const deps = ws.get('dependencies') || {};
            Object.keys(deps)
                .filter((depName) => names.includes(depName))
                .forEach((depName) => {
                    const list = dependentMap[depName] || [];
                    if (!list.includes(name)) {
                        list.push(name);
                        dependentMap[depName] = list;
                    }
                });
        });

        function reduceDependencies(name, result = []) {
            return (dependentMap[name] || [])
                .reduce((arr, depName) => {
                    if (arr.includes(depName)) {
                        return arr;
                    }
                    arr.push(depName);
                    return reduceDependencies(depName, result);
                }, result);
        }

        for (let name in dependentMap) {
            dependentMap[name] = reduceDependencies(name);
        }

        const dependenciesMap = {};
        names.forEach((name) => {
            const list = [];
            for (let depName in dependentMap) {
                if (dependentMap[depName].includes(name)) {
                    list.push(depName);
                }
            }
            dependenciesMap[name] = list;
        });

        const wwsSorted = [];
        wss.forEach((ws1) => {
            const name1 = ws1.get('name');
            const index = wwsSorted.findIndex((ws2) => {
                const name2 = ws2.get('name');
                const deps = dependenciesMap[name2] || [];
                return deps.includes(name1);
            });
            if (index === -1) {
                wwsSorted.push(ws1);
            } else {
                wwsSorted.splice(index, 0, ws1);
            }
        });

        this.workspacesDepsMap = dependenciesMap;
        this.workspaces = wwsSorted;
    }

    /**
     * Get Project dpendencies in workspaces.
     * @param {Project} project The entry project.
     * @return {Project[]} A list of dependencies.
     */
    getWorkspaceDependencies(project) {
        const wss = this.workspaces;
        const map = this.workspacesDepsMap;
        if (!wss) {
            return [];
        }
        const name = project.get('name');
        if (!map[name]) {
            return [];
        }
        return wss.filter((ws) => map[name].includes(ws.get('name')));
    }

    /**
     * The browserslist query for the current project.
     * @type {Array<string>}
     */
    get browserslist() {
        if (this.file('browserslist.json').exists()) {
            // browserslist.json exists in the root of the project.
            return this.file('browserslist.json').readJson();
        }

        if (this.get('browserslist')) {
            // found browserslist field in package.json.
            return this.get('browserslist');
        }

        let parent = this.parent;
        if (parent) {
            // use parent query if in monorepo.
            return parent.browserslist;
        }

        // use default query.
        return [
            'ie >= 11',
            'iOS >= 9',
            'Android >= 4.4',
            'Safari >= 9',
            'last 3 Firefox major versions',
            'unreleased Firefox versions',
            'Chrome 45',
            'last 3 Chrome major versions',
            'unreleased Chrome versions',
            'last 3 Edge major versions',
        ];
    }

    /**
     * Update package.json file.
     * @return {void}
     */
    save() {
        this.packageJson.writeJson(this.json);
    }

    /**
     * Load package.json data from file.
     * @return {void}
     */
    load() {
        this.json = this.packageJson.readJson();
    }

    /**
     * Get a field from the package.json.
     * @param {string} key The field name to retrieve.
     * @return {*} The value of the field.
     */
    get(key) {
        return keypath.get(this.json, key);
    }

    /**
     * Set a field to the package.json.
     * @param {string} key The field name to update.
     * @param {*} value The value to set.
     * @return {Object} The updated JSON.
     */
    set(key, value) {
        if (typeof key === 'object') {
            for (let k in key) {
                this.set(k, key[k]);
            }
            return this.json;
        }
        keypath.set(this.json, key, value);
        if (key === 'directories') {
            this.setupDirectories();
        } else if (key === 'workspaces') {
            this.setupWorkspaces();
        }
        return this.json;
    }

    /**
     * Unset a field from the package.json.
     * @param {string} key The field name.
     * @return {Object} The updated JSON.
     */
    unset(key) {
        keypath.del(this.json, key);
        return this.json;
    }

    /**
     * Resolve patterns from the current project.
     * If the project is a monorepo, resolve packages names as Project instances.
     * @param {Array<string>|string} patterns The glob patterns to resolve.
     * @return {Array<Project|File|Directory>} The list of resolved entries.
     */
    resolve(patterns) {
        let workspaces = this.workspaces;
        if (!workspaces) {
            return super.resolve(patterns);
        }

        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }

        let files = [];
        let filesPatterns = patterns.filter((pattern) => {
            let matchProject = workspaces.find((project) => project.get('name') === pattern);
            if (matchProject) {
                files.push(matchProject);
                return false;
            }
            return true;
        });

        files.push(...super.resolve(filesPatterns));

        return files;
    }

    /**
     * Set repository field in package.json.
     * @param {string} url The url of the repository.
     * @param {string} type The type of the repository.
     * @return {void}
     */
    setRepository(url, type = 'git') {
        this.set('repository', {
            type,
            url,
        });
    }

    async publish(version, git, npm) {
        if (this.git.check() && this.git.hasChanges()) {
            throw new Error(`uncommitted or unpushed changes in the repository ${this.git.cwd}`);
        }

        const parent = this.parent;
        const workspaces = this.workspaces;
        if ((workspaces && this.file('lerna.json').exists()) || (parent && parent.file('lerna.json').exists())) {
            return await this.publishWithLerna(version, git, npm);
        }

        const projects = [this, ...(workspaces || [])];
        const crypto = require('crypto');
        const semver = require('semver');

        let args = ['--no-git-tag-version'];
        let hash = this.git.check() && this.git.getShortCommitCode() || crypto.createHash('md5').update(current).digest('hex');
        let tag;
        let current = this.get('version');
        let newVersion;
        if (version === 'canary') {
            tag = 'alpha';
            newVersion = semver.inc(current, 'prerelease', 'alpha').replace(/\.\d+$/, `.${hash.trim()}`);
        } else if (version === 'alpha') {
            tag = 'alpha';
            newVersion = semver.inc(current, 'prerelease', 'alpha');
        } else if (version === 'beta') {
            tag = 'beta';
            newVersion = semver.inc(current, 'prerelease', 'beta');
        } else if (version === 'rc') {
            tag = 'rc';
            newVersion = semver.inc(current, 'prerelease', 'rc');
        } else if (version === 'patch') {
            newVersion = semver.inc(current, 'patch');
        } else if (version === 'minor') {
            newVersion = semver.inc(current, 'minor');
        } else if (version === 'major') {
            newVersion = semver.inc(current, 'major');
        } else if (version) {
            newVersion = version;
        } else if (!process.env.CI) {
            // prompt
            const answers = await inquirer.prompt([
                {
                    name: 'version',
                    message: 'select the version to bump',
                    type: 'list',
                    choices: [
                        `patch (${semver.inc(current, 'patch')})`,
                        `minor (${semver.inc(current, 'minor')})`,
                        `major (${semver.inc(current, 'major')})`,
                        `alpha (${semver.inc(current, 'prerelease', 'alpha')})`,
                        `beta (${semver.inc(current, 'prerelease', 'beta')})`,
                        `rc (${semver.inc(current, 'prerelease', 'rc')})`,
                        `canary (${semver.inc(current, 'prerelease', 'alpha').replace(/\.\d+$/, `.${hash.trim()}`)})`,
                    ],
                },
            ]);
            return await this.publish(answers.version.split(' ')[0], git, npm);
        }

        if (!newVersion) {
            throw new Error('missing version to publish');
        }

        if (workspaces) {
            await Promise.all(
                [this, ...workspaces].map((p) => p.packageManager.version(newVersion, args))
            );
        } else {
            await this.packageManager.version(newVersion, args);
        }

        if (this.git.check() && git) {
            await this.git.release(newVersion);
        }

        if (npm) {
            if (workspaces) {
                await Promise.all(
                    projects.map((p) => p.packageManager.publish(tag))
                );
            } else {
                await this.packageManager.publish(newVersion, tag);
            }
        }
    }

    async publishWithLerna(version, git = true, npm = true) {
        const exec = require('./exec');
        const BIN = require.resolve('lerna/cli.js');

        let command = npm === false ? 'version' : 'publish';
        let args = ['--force-publish'];
        if (git === false || !this.git.check()) {
            args.push('--no-git-tag-version', '--no-push');
        } else {
            args.push('--push');
        }
        if (version === 'canary') {
            args.push('--canary');
        } else if (version === 'alpha') {
            args.push('--canary', '--preid alpha');
        } else if (version === 'beta') {
            args.push('--canary', '--preid beta');
        } else if (version === 'rc') {
            args.push('--canary', '--preid rc');
        } else if (version === 'patch') {
            args.unshift('patch');
        } else if (version === 'minor') {
            args.unshift('minor');
        } else if (version === 'major') {
            args.unshift('major');
        } else if (version) {
            args.unshift(version);
        }
        if (process.env.CI) {
            args.push('--yes');
        }

        return await exec(BIN, [command, ...args]);
    }
}

module.exports = {
    JS_EXTENSIONS,
    STYLE_EXTENSIONS,
    HTML_EXTENSIONS,
    WEBMANIFEST_EXTENSIONS,
    isJSFile,
    isStyleFile,
    isHTMLFile,
    isWebManifestFile,
    prettyBytes,
    Entry,
    File,
    Directory,
    Project,
};
