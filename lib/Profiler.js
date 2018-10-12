const { EventEmitter } = require('events');

/**
 * @class Profile
 * A profile object with timings measurement.
 * @property {Object} tasks The set of child profiles.
 */
class Profile extends EventEmitter {
    /**
     * Create a Profile.
     * @param {string} name The name of the profile.
     * @param {boolean} autostart Should the profile starts after initialization.
     * @return {Profile}
     */
    constructor(name, autostart = true) {
        super();
        this.name = name;
        this.timeStart = 0;
        if (autostart) {
            this.start();
        }
        this.tasks = {};
    }

    /**
     * Set data from external source.
     * @param {number} diff The time diff.
     * @return {number}
     */
    set(diff) {
        this.timeStart = 0;
        this.timeEnd = diff;
        return this.diff();
    }

    /**
     * Start the measurement.
     * @emits start The start event.
     * @return {void}
     */
    start() {
        this.timeStart = Date.now();
        this.emit('start');
    }

    /**
     * End the measurement.
     * @emits end The end event with measurement value.
     * @return {number}
     */
    end() {
        if (!this.timeEnd) {
            this.timeEnd = Date.now();
        }
        let diff = this.diff();
        this.emit('end', diff);
        return diff;
    }

    /**
     * Calculate the measurement value.
     * @private
     * @return {number}
     */
    diff() {
        return this.timeEnd - this.timeStart;
    }

    /**
     * Create a child Profile task.
     * @param {string} name The child Profile name.
     * @param {boolean} autostart Should the child profile start after initialization.
     * @return {Profile}
     */
    task(name, autostart) {
        this.tasks[name] = new Profile(name, autostart);
        return this.tasks[name];
    }
}

/**
 * @class Profiler
 * Create a Profiler helper for CLI.
 * @property {Object} tasks The set of child profiles.
 * @emits profile The profile end event with Profile reference.
 */
class Profiler extends EventEmitter {
    /**
     * Print profile results in console.
     * @param {Profiler} profile The profile to log.
     * @param {Number} [subLevel] The sub task level.
     */
    static format(profile, level = 0) {
        let icon = level === 0 ? '⏱ ' : '↳';
        let log = `${icon} ${profile.name}: ${Profiler.formatTime(profile.diff())}`;
        level++;
        for (let k in profile.tasks) {
            let sub = profile.tasks[k];
            if (sub.end) {
                let logEntry = Profiler.format(sub, level);
                log += `\n${logEntry.padStart(logEntry.length + level * 2 + 1, ' ')}`;
            }
        }
        return log;
    }

    /**
     * Print profile time with colors.
     * @param {Number} time The time to output.
     */
    static formatTime(time) {
        time = Math.round(time);
        return `${time}ms`;
    }

    /**
     * Create a Profiler instance.
     * @return {Profiler}
     */
    constructor() {
        super();
        this.tasks = {};
    }

    /**
     * Create a child Profile task.
     * @param {string} name The child Profile name.
     * @param {boolean} autostart Should the child profile start after initialization.
     * @return {Profile}
     */
    task(name, autostart) {
        let profile = this.tasks[name] = new Profile(name, autostart);
        profile.on('end', () => {
            this.emit('profile', profile);
        });
        return profile;
    }
}

module.exports = Profiler;
