function Profiler(name, autostart = true) {
    this.name = name;
    if (autostart) {
        this.timeStart = Date.now();
    } else {
        this.timeStart = 0;
    }
    this.tasks = {};
}

Profiler.prototype.set = function(diff) {
    this.timeStart = 0;
    this.timeEnd = diff;
    return this.diff();
};

Profiler.prototype.end = function() {
    if (!this.timeEnd) {
        this.timeEnd = Date.now();
    }
    return this.diff();
};

Profiler.prototype.diff = function() {
    return this.timeEnd - this.timeStart;
};

Profiler.prototype.task = function(name, autostart) {
    this.tasks[name] = new Profiler(name, autostart);
    return this.tasks[name];
};

Profiler.prototype.endTask = function(name) {
    return this.tasks[name].end();
};

module.exports = Profiler;
