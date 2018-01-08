module.exports = class Profiler {
    constructor(name, autostart = true) {
        this.name = name;
        this.timeStart = 0;
        if (autostart) {
            this.start();
        }
        this.tasks = {};
    }

    set(diff) {
        this.timeStart = 0;
        this.timeEnd = diff;
        return this.diff();
    }

    start() {
        this.timeStart = Date.now();
    }

    end() {
        if (!this.timeEnd) {
            this.timeEnd = Date.now();
        }
        return this.diff();
    }

    diff() {
        return this.timeEnd - this.timeStart;
    }

    task(name, autostart) {
        this.tasks[name] = new Profiler(name, autostart);
        return this.tasks[name];
    }
};
