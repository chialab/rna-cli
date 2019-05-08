const { EventEmitter } = require('events');

class TestRunner extends EventEmitter {
    constructor(app, project) {
        super();
        this.app = app;
        this.project = project;
    }

    async setup(options) {
        this.options = Object.assign({}, options);
    }

    async run() {
        return {
            exitCode: 1,
            coverage: null,
            failed: null,
        };
    }
}

module.exports = TestRunner;
