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
    }

    isPassed() {
        return (this.passes > 0 && this.failes === 0);
    }

    isFailed() {
        return this.failes > 0;
    }

    pass(howMany = 1) {
        this.passes += howMany;
    }

    fail(error, howMany = 1) {
        this.failes += howMany;

        // more than one error per test
        if (this.error && error instanceof Error) {
            if (error.multiple) {
                this.error.multiple = [
                    ...(this.error.multiple || []),
                    ...error.multiple,
                ];
            } else {
                this.error.multiple = [
                    ...(this.error.multiple || []),
                    error,
                ];
            }
        } else {
            this.error = error;
        }
    }
}

module.exports.Test = Test;
