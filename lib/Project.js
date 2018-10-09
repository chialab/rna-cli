const path = require('path');
const { NavigatorDirectory } = require('./Navigator');
const PackageManager = require('./PackageManager');
const { keypath } = require('@chialab/proteins');

const DEFAULTS = [
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

class Project extends NavigatorDirectory {
    constructor(directory, cwd) {
        super(directory, cwd);
        this.packageJson = this.file('package.json');
        this.packageManager = new PackageManager(directory);
        if (this.packageJson.exists()) {
            this.load();
        } else {
            this.json = {
                name: path.basename(directory).toLowerCase().replace(/\s+/g, '_'),
            };
        }
    }

    get scopeName() {
        return this.get('name').split('/').shift().toLowerCase();
    }

    get scopeModule() {
        return this.get('name').split('/').pop().toLowerCase();
    }

    get isNew() {
        return !this.packageJson.exists();
    }

    get parent() {
        let paths = this.path.split(path.sep).slice(0, -1);
        while (paths.length) {
            paths.pop();
            let superProject = new Project(paths.join(path.sep));
            if (superProject.isNew) {
                continue;
            }
            let workspaces = superProject.workspaces;
            if (!workspaces) {
                break;
            }
            return workspaces.find((ws) => ws.path === this.path);
        }
        return null;
    }

    get directories() {
        let config = this.get('directories') || {};
        let directories = {};
        for (let key in config) {
            directories[key] = this.directory(config[key]);
        }
        return directories;
    }

    get workspaces() {
        let directories = [];
        let workspaces = this.get('workspaces');
        if (!workspaces) {
            return null;
        }
        workspaces.forEach((ws) => {
            directories.push(...this.resolve(ws, false));
        });
        return directories
            .filter((entry) => entry instanceof NavigatorDirectory)
            .map((entry) => new Project(entry.path, this.cwd || this.path));
    }

    get browserslist() {
        if (this.file('browserslist.json').exists()) {
            return this.file('browserslist.json').readJson();
        }

        if (this.get('browserslist')) {
            return this.get('browserslist');
        }

        let parent = this.parent;
        if (parent) {
            return parent.browserslist;
        }

        return DEFAULTS;
    }

    save() {
        this.packageJson.writeJson(this.json);
    }

    load() {
        this.json = this.packageJson.readJson();
    }

    get(key) {
        return keypath.get(this.json, key);
    }

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

    unset(key) {
        keypath.del(this.json, key);
        return this.json;
    }

    resolve(pattern, checkWorkspaces = true) {
        if (!checkWorkspaces) {
            return super.resolve(pattern);
        }

        let workspaces = this.workspaces;
        if (!workspaces) {
            return super.resolve(pattern);
        }

        if (!Array.isArray(pattern)) {
            pattern = [pattern];
        }

        let files = [];
        let filesPatterns = pattern.filter((pattern) => {
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

    setRepository(url, type = 'git') {
        this.set('repository', {
            type,
            url,
        });
    }
}

module.exports = Project;
