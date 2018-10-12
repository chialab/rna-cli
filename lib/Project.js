const path = require('path');
const { NavigatorDirectory } = require('./Navigator');
const PackageManager = require('./PackageManager');
const { keypath } = require('@chialab/proteins');

/**
 * The default browserslist query for browsers support.
 * @type {Array<string>}
 */
const DEFAULT_BROWSERSLIST_QUERY = [
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

/**
 * @class Project
 * @extends NavigatorDirectory
 * A Node project reference.
 */
class Project extends NavigatorDirectory {
    /**
     * Create a new project reference.
     * @param {string} root The root of the project.
     * @param {string} cwd The parent monorepo root.
     * @return {Project}
     */
    constructor(root, cwd) {
        super(root, cwd);
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
            .map((entry) => new Project(entry.path, this.cwd || this.path));
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
        return DEFAULT_BROWSERSLIST_QUERY;
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

module.exports = Project;
