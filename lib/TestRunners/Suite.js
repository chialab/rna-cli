const { Test } = require('./Test');

class Suite {
    get isRoot() {
        return !this.parent;
    }

    get path() {
        if (this.isRoot) {
            return [];
        }

        let result = [];
        let parent = this;
        while (parent) {
            result.unshift(parent.title);
            parent = parent.parent;
        }

        return result;
    }

    constructor(title = '') {
        this.title = title;
        this.suites = [];
        this.tests = [];
    }

    find(path, where = 'tests') {
        if (!path.length) {
            return this;
        }

        path = path.slice(0);
        let title = path[path.length - 1];
        let parent = this.find(path.slice(0, -1), 'suites');
        if (!parent) {
            return null;
        }

        return parent[where].find((child) => child.title === title) || null;
    }

    ensureSuite(path) {
        if (!path.length) {
            return this;
        }

        path = path.slice(0);
        let title = path[path.length - 1];
        let parent = this.ensureSuite(path.slice(0, -1));
        let child = parent.suites.find((child) => child.title === title);
        if (!child) {
            child = new Suite(title);
            child.parent = parent;
            parent.suites.push(child);
        }

        return child;
    }

    add(test, path) {
        if (typeof test === 'string') {
            test = new Test(test);
        } else if (Array.isArray(test)) {
            path = test;
            test = new Test(path[path.length - 1]);
        }

        path = path ? path : test.path;
        let parent = this.ensureSuite(path.slice(0, -1));
        let child = parent.tests.find((child) => child.title === test.title);
        if (!child) {
            child = new Test(test.title);
            child.parent = parent;
            parent.tests.push(child);
        }

        return child;
    }
}

module.exports.Suite = Suite;
