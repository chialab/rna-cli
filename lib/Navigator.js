const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');
const gzipSize = require('gzip-size');
const { keypath } = require('@chialab/proteins');
const PackageManager = require('./PackageManager');

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
    } else if (size > MEGA) {
        return `${(size / MEGA).toFixed(1)} MB`;
    } else if (size > KILO) {
        return `${(size / KILO).toFixed(1)} KB`;
    }
    return `${size} B`;
}

/**
 * @class NavigatorEntry
 * A file reference with some utils methods.
 * @property {string} path The file path.
 */
class NavigatorEntry {
    /**
     * Create a NavigatorEntry.
     * @param {string} file The absolute file path.
     * @return {NavigatorEntry}
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
        return path.dirname(this.path);
    }

    /**
     * The file size.
     * @type {FileSize}
     */
    get size() {
        let sizes = {
            size: new Number(fs.statSync(this.path).size),
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
     * @type {NavigatorDirectory}
     */
    get parent() {
        if (!this.dirname) {
            return null;
        }
        return new NavigatorDirectory(this.dirname);
    }

    /**
     * The NPM project of the file.
     * @type {Project}
     */
    get project() {
        let projectPath = this;
        if (projectPath instanceof NavigatorFile) {
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
     * @param {string|NavigatorEntry} file The relative file.
     * @return {string} The relative file path.
     */
    relative(file) {
        if (file instanceof NavigatorEntry) {
            file = file.path;
        }
        return path.relative(this.path, file);
    }

    /**
     * Check if the reference is a file.
     * @return {boolean}
     */
    isFile() {
        return fs.statSync(this.path).isFile();
    }

    /**
     * Check if the reference is a directory.
     * @return {boolean}
     */
    isDirectory() {
        return fs.statSync(this.path).isDirectory();
    }

    /**
     * Check if the reference exists.
     * @return {boolean}
     */
    exists() {
        return fs.existsSync(this.path);
    }

    /**
     * Remove the file if exists.
     * @return {void}
     */
    unlink() {
        if (this.exists()) {
            fs.removeSync(this.path);
        }
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
        if (to instanceof NavigatorEntry) {
            to = to.path;
        }
        fs.copySync(this.path, to, {
            overwrite: true,
        });
        this.path = to;
    }

    /**
     * Move a file to a new position.
     */
    move(to) {
        if (to instanceof NavigatorEntry) {
            to = to.path;
        }
        fs.moveSync(this.path, to, {
            overwrite: true,
        });
        this.path = to;
    }
}

/**
 * @class NavigatorFile
 * @extends NavigatorEntry
 * A NavigatorEntry which represent a File.
 */
class NavigatorFile extends NavigatorEntry {
    /**
     * The map file reference for the current file.
     * @type {NavigatorFile}
     */
    get mapFile() {
        return this.ext(`${this.extname}.map`);
    }

    /**
     * The md5 hash of the file.
     * @return {string}
     */
    hash() {
        const BUFFER_SIZE = 8192;
        const fd = fs.openSync(this.path, 'r');
        const hash = crypto.createHash('md5');
        const buffer = Buffer.alloc(BUFFER_SIZE);

        try {
            let bytesRead;
            do {
                bytesRead = fs.readSync(fd, buffer, 0, BUFFER_SIZE);
                hash.update(buffer.slice(0, bytesRead));
            } while (bytesRead === BUFFER_SIZE);
        } finally {
            fs.closeSync(fd);
        }

        return hash.digest('hex');
    }

    /**
     * Read file content.
     * @return {string}
     */
    read() {
        try {
            return fs.readFileSync(this.path, 'utf8');
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
        fs.ensureDirSync(path.dirname(this.path));
        fs.writeFileSync(this.path, content);
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
 * @class NavigatorDirectory
 * @extends NavigatorEntry
 * A NavigatorEntry which represent a Directory.
 */
class NavigatorDirectory extends NavigatorEntry {
    /**
     * Ensure the directory to exists.
     * @return {void}
     */
    ensure() {
        fs.ensureDirSync(this.path);
    }

    /**
     * Empty the directory.
     * @return {void}
     */
    empty() {
        fs.emptyDirSync(this.path);
    }

    /**
     * Resolve glob patterns relative to the directory.
     * @param {Array<string>|string} patterns Glob patterns.
     * @return {Array<NavigatorFile|NavigatorDirectory>} A list of resolved entries.
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
            let stats = fs.statSync(file);
            if (stats.isDirectory()) {
                return new NavigatorDirectory(file);
            } else if (stats.isFile()) {
                return new NavigatorFile(file);
            }
        }).filter(Boolean);
    }

    /**
     * Get a child entry for the directory.
     * @param {string} file The child reference path.
     * @return {NavigatorEntry}
     */
    entry(file) {
        return new NavigatorEntry(path.resolve(this.path, file));
    }

    /**
     * Get a child file for the directory.
     * @param {string} file The child file path.
     * @return {NavigatorFile}
     */
    file(file) {
        return new NavigatorFile(path.resolve(this.path, file));
    }

    /**
     * Get a child directory for the directory.
     * @param {string} directory The child directory path.
     * @return {NavigatorDirectory}
     */
    directory(directory) {
        return new NavigatorDirectory(path.resolve(this.path, directory));
    }

    /**
     * Get directory children entries list.
     * @return {Array<NavigatorFile|NavigatorDirectory>}
     */
    children() {
        if (!this.exists()) {
            return null;
        }

        let children = fs.readdirSync(this.path);
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
     * @return {Array<NavigatorFile>}
     */
    files() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isFile());
    }

    /**
     * Get directory children directories list.
     * @return {Array<NavigatorDirectory>}
     */
    directories() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isDirectory());
    }
}

/**
 * @class Project
 * @extends NavigatorDirectory
 * A Node project reference.
 */
class Project extends NavigatorDirectory {
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
        let paths = this.path.split(path.sep).slice(0, -1);
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
     * @type {Array<NavigatorDirectory>}
     */
    get directories() {
        let config = this.get('directories') || {};
        let directories = {};
        for (let key in config) {
            directories[key] = this.directory(config[key]);
        }
        return directories;
    }

    /**
     * Get workspaces Project references if Project is monorepo.
     * @type {Array<Project>}
     */
    get workspaces() {
        let workspaces = this.get('workspaces');
        if (!workspaces) {
            // the current project is not a monorepo.
            return null;
        }
        let directories = [];
        // find workspaces roots.
        workspaces.forEach((ws) => {
            directories.push(...super.resolve(ws, false));
        });
        // transform directories into projects.
        return directories
            .filter((entry) => entry instanceof NavigatorDirectory)
            .map((entry) => new Project(entry.path));
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
            'last 3 iOS major versions',
            'Android >= 4.4',
            'last 3 Safari major versions',
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
     * @return {Array<Project|NavigatorFile|NavigatorDirectory>} The list of resolved entries.
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
}

module.exports = {
    NavigatorEntry,
    NavigatorFile,
    NavigatorDirectory,
    Project,
};
