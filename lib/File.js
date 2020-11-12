const { promises: { realpath, writeFile, stat, unlink, readFile, readdir, mkdir, copyFile, rmdir, open }, constants } = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');
const gzipSize = require('gzip-size');
const chokidar = require('chokidar');
const resolve = require('resolve');
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
     * @return {Promise<FileSize>}
     */
    async size() {
        let [stats, gzip] = await Promise.all([
            stat(this.path),
            gzipSize.file(this.path),
        ]);
        let sizes = {
            size: new Number(stats.size),
            zipped: new Number(gzip),
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
     * @return {Promise<boolean>}
     */
    async isFile() {
        return (await stat(this.path)).isFile();
    }

    /**
     * Check if the reference is a directory.
     * @return {boolean}
     */
    async isDirectory() {
        return (await stat(this.path)).isDirectory();
    }

    /**
     * Check if the reference exists.
     * @return {Promise<boolean>}
     */
    async exists() {
        try {
            await stat(this.path);
            return true;
        } catch(err) {
            return false;
        }
    }

    /**
     * Check if the reference does not exist.
     * @return {Promise<boolean>}
     */
    async isNew() {
        return !(await this.exists());
    }

    /**
     * Remove the file if exists.
     * @return {Promise<void>}
     */
    async unlink() {
        return;
    }

    /**
     * Change file extension.
     * @param {string} ext The new extension.
     * @return {void}
     */
    ext(ext) {
        return this.rename(`${this.basename}${ext}`);
    }

    /**
     * Rename the file.
     * @param {string} name The new name.
     * @return {void}
     */
    rename(name) {
        let dest = path.join(this.dirname, name);
        return new this.constructor(dest);
    }

    /**
     * Copy a file to a new position.
     */
    async copy(to) {
        if (to instanceof Entry) {
            to = to.path;
        }
        await mkdir(path.dirname(to), { recursive: true });
        await copyFile(this.path, to, constants.COPYFILE_FICLONE);
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
     * @return {Promise<string>}
     */
    async hash() {
        let BUFFER_SIZE = 8192;
        let fd = await open(this.path, 'r');
        let hash = crypto.createHash('md5');
        let buffer = Buffer.alloc(BUFFER_SIZE);

        try {
            let bytesRead;
            do {
                bytesRead = await readFile(fd, buffer, 0, BUFFER_SIZE);
                hash.update(buffer.slice(0, bytesRead));
            } while (bytesRead === BUFFER_SIZE);
        } finally {
            await fd.close();
        }

        return hash.digest('hex');
    }

    /**
     * @inheritdoc
     */
    async unlink() {
        if (await this.isNew()) {
            return;
        }
        await unlink(this.path);
    }

    /**
     * Read file content.
     * @return {Promise<string>}
     */
    async read() {
        try {
            return readFile(this.path, 'utf8');
        } catch (err) {
            return null;
        }
    }

    /**
     * Write file content.
     * @param {string} content The content to write.
     * @return {Promise<void>}
     */
    async write(content) {
        await this.parent.ensure();

        return writeFile(this.path, content);
    }

    /**
     * Read file content as JSON.
     * @return {Object}
     */
    async readJson() {
        let data = await this.read();
        if (data) {
            data = JSON.parse(data);
        }

        return data;
    }

    /**
     * Write file content as JSON.
     * @param {Object} data The JSON to write.
     * @return {Promise<void>}
     */
    writeJson(data) {
        return this.write(JSON.stringify(data, null, 2));
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
    async unlink() {
        if (await this.isNew()) {
            return;
        }
        await this.empty();
        await rmdir(this.path);
    }

    /**
     * Ensure the directory to exists.
     * @return {Promise<void>}
     */
    async ensure() {
        await mkdir(this.path, { recursive: true });
    }

    /**
     * Empty the directory.
     * @return {Promise<void>}
     */
    async empty() {
        let children = await this.children();
        await Promise.all(
            children.map(async (child) => {
                await child.unlink();
            })
        );
    }

    /**
     * Resolve glob patterns relative to the directory.
     * @param {Array<string>|string} patterns Glob patterns.
     * @return {Promise<Array<File|Directory>>} A list of resolved entries.
     */
    async resolve(patterns) {
        let paths = [];
        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }

        await Promise.all(
            patterns.map(async (pattern) => {
                let results = await new Promise((resolve, reject) => {
                    glob(pattern, {
                        cwd: this.path,
                        absolute: true,
                    }, (err, files) => {
                        if (err) {
                            return reject(err);
                        }

                        resolve(files);
                    });
                });

                results.forEach((file) => {
                    if (!paths.includes(file)) {
                        paths.push(file);
                    }
                });
            })
        );

        let files = await paths.map(async (file) => {
            let stats = await stat(file);
            if (stats.isDirectory()) {
                return new Directory(file);
            }
            if (stats.isFile()) {
                return new File(file);
            }
            return null;
        });

        return files.filter(Boolean);
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
     * @return {Promise<Array<File|Directory>>}
     */
    async children() {
        if (await this.isNew()) {
            return [];
        }

        let children = await readdir(this.path);
        return Promise.all(
            children.map(async (file) => {
                let entry = this.entry(file);
                if (await entry.isDirectory()) {
                    return this.directory(file);
                }
                return this.file(file);
            })
        );
    }

    /**
     * Get directory children files list.
     * @return {Promise<Array<File>>}
     */
    async files() {
        if (await this.isNew()) {
            return null;
        }

        let children = await this.children();
        let files = await Promise.all(
            children.map(async (child) => {
                if (await child.isFile()) {
                    return child;
                }
                return;
            })
        );

        return files.filter(Boolean);
    }

    /**
     * Get directory children directories list.
     * @return {Promise<Array<Directory>>}
     */
    async directories() {
        if (await this.isNew()) {
            return null;
        }

        let children = await this.children();
        let directories = await Promise.all(
            children.map(async (child) => {
                if (await child.isDirectory()) {
                    return child;
                }
                return;
            })
        );

        return directories.filter(Boolean);
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
            ignore: /(^|[/\\])\../,
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
            ignored: /(^|[/\\])\../,
        }).on('change', async (fileName) => {
            fileName = await realpath(fileName);
            let entry = this.entry(fileName);
            if (shouldIgnore(entry)) {
                return;
            }
            let eventType = 'change';
            if (await entry.isNew()) {
                eventType = 'unlink';
                hashesMap.delete(entry.path);
            } else if (await entry.isDirectory()) {
                entry = this.directory(fileName);
            } else {
                entry = this.file(fileName);
                let hash = await entry.hash;
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
    static async getProject(entry) {
        if (!(entry instanceof Entry)) {
            entry = new Entry(entry);
        }
        if (entry instanceof File) {
            entry = entry.parent;
        }
        let packageJsonFile;
        while (entry) {
            if (entry instanceof Project) {
                return entry;
            }

            packageJsonFile = entry.file('package.json');
            if (await packageJsonFile.exists()) {
                return Project.init(entry.path);
            }

            entry = entry.parent;
        }
        return null;
    }

    static sort(projects) {
        const names = projects.map((project) => project.get('name'));
        const dependentMap = {};
        projects.forEach((project) => {
            const name = project.get('name');
            const deps = project.get('dependencies') || {};
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

        let map = {};
        names.forEach((name) => {
            let list = [];
            for (let depName in dependentMap) {
                if (dependentMap[depName].includes(name)) {
                    list.push(depName);
                }
            }
            map[name] = list;
        });

        let list = [];
        projects.forEach((ws1) => {
            let name1 = ws1.get('name');
            let index = list.findIndex((ws2) => {
                let name2 = ws2.get('name');
                let deps = map[name2] || [];
                return deps.includes(name1);
            });
            if (index === -1) {
                list.push(ws1);
            } else {
                list.splice(index, 0, ws1);
            }
        });

        return { list, map };
    }

    static async init(root) {
        let project = new this(root);
        await project.initialize();
        return project;
    }

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
    }

    async initialize() {
        // load package.json if exists.
        if (await this.packageJson.exists()) {
            await this.load();
        } else {
            // setup a new project using root base name.
            this.json = {
                name: path.basename(this.path).toLowerCase().replace(/\s+/g, '_'),
            };
        }

        // git client instance
        this.git = new Git(this.path);

        this.setupDirectories();
        await this.setupWorkspaces();
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
     * The parent Project reference if in workspace.
     * @return {Promise<Project>}
     */
    async getParent() {
        let paths = path.dirname(this.path).split(path.sep);
        while (paths.length) {
            paths.pop();
            let superProject = await Project.init(paths.join(path.sep));
            if (await superProject.isNew()) {
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
     * @return {Promise<void>}
     */
    async setupWorkspaces() {
        let workspaces = this.get('workspaces');
        if (!workspaces) {
            // the current project is not a monorepo.
            return null;
        }

        let directories = [];
        // find workspaces roots.
        await Promise.all(
            workspaces.map(async (ws) => {
                let subEntries = await super.resolve(ws, false);
                directories.push(...subEntries);
            })
        );

        // transform directories into projects.
        let wss = (await Promise.all(
            directories
                .filter((entry) => entry instanceof Directory)
                .map((entry) => Project.init(entry.path))
                .map(async (project) => {
                    if (await project.isNew()) {
                        return null;
                    }

                    return project;
                })
        )).filter(Boolean);

        let { list, map } = Project.sort(wss);
        this.workspaces = list;
        this.workspacesDepsMap = map;
    }

    /**
     * Get Project dependencies in workspaces.
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
     * Get linked Project dpendencies.
     * @return {Promise<Project[]>} A list of linked dependencies.
     */
    async getLinkedDependencies() {
        const dependenciesMap = this.get('dependencies') || {};
        const dependencies = Object.keys(dependenciesMap);
        return (await Promise.all(
            dependencies
                .map((name) => resolve.sync(name, {
                    basedir: this.path,
                    pathFilter: () => 'package.json',
                    preserveSymlinks: true,
                }))
                .filter((pkgFile) => pkgFile.endsWith('.json'))
                .map((pkgFile) => path.dirname(pkgFile))
                .map(async (dir) => {
                    let realPath = await realpath(dir);
                    if (realPath === dir) {
                        return null;
                    }

                    return Project.init(realPath);
                })
        )).filter(Boolean);
    }

    /**
     * The browserslist query for the current project.
     * @type {Promise<Array<string>>}
     */
    async browserslist() {
        if (await this.file('browserslist.json').exists()) {
            // browserslist.json exists in the root of the project.
            return this.file('browserslist.json').readJson();
        }

        if (this.get('browserslist')) {
            // found browserslist field in package.json.
            return this.get('browserslist');
        }

        let parent = await this.getParent();
        if (parent) {
            // use parent query if in monorepo.
            return parent.browserslist();
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
            'Edge 15',
            'Edge 17',
            'Edge 18',
        ];
    }

    /**
     * Update package.json file.
     * @return {Promise<void>}
     */
    async save() {
        return this.packageJson.writeJson(this.json);
    }

    /**
     * Load package.json data from file.
     * @return {void}
     */
    async load() {
        this.json = await this.packageJson.readJson();
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
     * @return {Promise<Object>} The updated JSON.
     */
    async set(key, value) {
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
            await this.setupWorkspaces();
        }
        return this.json;
    }

    /**
     * Unset a field from the package.json.
     * @param {string} key The field name.
     * @return {Promise<Object>} The updated JSON.
     */
    async unset(key) {
        keypath.del(this.json, key);
        if (key === 'workspaces') {
            await this.setupWorkspaces();
        }
        return this.json;
    }

    /**
     * Resolve patterns from the current project.
     * If the project is a monorepo, resolve packages names as Project instances.
     * @param {Array<string>|string} patterns The glob patterns to resolve.
     * @return {Promise<Array<Project|File|Directory>>} The list of resolved entries.
     */
    async resolve(patterns) {
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

        let subEntries = await super.resolve(filesPatterns);
        files.push(...subEntries);

        return files;
    }

    /**
     * Set repository field in package.json.
     * @param {string} url The url of the repository.
     * @param {string} type The type of the repository.
     * @return {Promise<any>}
     */
    async setRepository(url, type = 'git') {
        return this.set('repository', {
            type,
            url,
        });
    }

    async publish(version, git, npm) {
        if (this.git.check() && this.git.hasChanges()) {
            throw new Error(`uncommitted or unpushed changes in the repository ${this.git.cwd}`);
        }

        const workspaces = this.workspaces;
        const parent = await this.getParent();
        if ((workspaces && await this.file('lerna.json').exists()) ||
            (parent && await parent.file('lerna.json').exists())) {
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
        const { exec } = require('./Shell');
        const BIN = require.resolve('lerna/cli');

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
