const { EventEmitter } = require('events');
const colors = require('colors/safe');

class Profile extends EventEmitter {
    constructor(name, autostart = true) {
        super();
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
        this.emit('start');
    }

    end() {
        if (!this.timeEnd) {
            this.timeEnd = Date.now();
        }
        let diff = this.diff();
        this.emit('end', diff);
        return diff;
    }

    diff() {
        return this.timeEnd - this.timeStart;
    }

    task(name, autostart) {
        this.tasks[name] = new Profile(name, autostart);
        return this.tasks[name];
    }
}

class Profiler extends EventEmitter {
    /**
     * Print profile results in console.
     * @param {Profiler} profile The profile to log.
     * @param {Number} [subLevel] The sub task level.
     */
    static format(profile, level = 0) {
        let icon = level === 0 ? '⏱ ' : '↳';
        let log = colors.grey(`${icon} ${profile.name}: ${Profiler.formatTime(profile.diff())}`);
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
        let res = `${time}ms`;
        if (time > 2000) {
            return colors.red(res);
        } else if (time > 1000) {
            return colors.yellow(res);
        }
        return res;
    }

    constructor() {
        super();
        this.tasks = {};
    }

    task(name, autostart) {
        let profile = this.tasks[name] = new Profile(name, autostart);
        profile.on('end', () => {
            this.emit('profile', profile);
        });
        return profile;
    }
}

module.exports = Profiler;
