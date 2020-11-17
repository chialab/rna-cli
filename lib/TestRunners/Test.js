class Test {
    get path() {
        let result = [];
        let parent = this;
        while (parent && !parent.isRoot) {
            result.unshift(parent.title);
            parent = parent.parent;
        }

        return result;
    }

    constructor(title) {
        this.title = title;
        this.passes = 0;
        this.failes = 0;
        this.errors = {};
    }

    isPassed() {
        return (this.passes > 0 && this.failes === 0);
    }

    isFailed() {
        return this.failes > 0;
    }

    pass() {
        this.passes += 1;
    }

    fail(error, env = '') {
        this.failes += 1;
        this.errors[env] = error;
    }
}

module.exports.Test = Test;
