const { EOL } = require('os');
const colors = require('colors/safe');
const { cursorHide, cursorShow, eraseLines } = require('ansi-escapes');
const stripAnsi = require('strip-ansi');

const isWindows = (process.platform === 'win32');
const symbols = isWindows ? {
    tick: '√',
    cross: '×',
    pointer: '❯',
    arrowDown: '↓',
} : {
    tick: '✔',
    cross: '✖',
    pointer: '❯',
    arrowDown: '↓',
};
const spinner = isWindows ? ['-', '\\', '|', '/'] : ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const spinnerFrames = spinner.length;
const spinnerSym = Symbol('spinner');

/** @typedef {{ title: string, output?: any, isCompleted(): boolean, isSkipped(): boolean, isPending: boolean, hasFailed(): boolean, isEnabled(): boolean, subtasks: Task[] }} Task */

/**
 * Get a spinner relative to current task.
 *
 * @param {Task} task Task.
 * @returns {string}
 */
const getSpinner = (task) => {
    if (!task[spinnerSym]) {
        task[spinnerSym] = function() {
            this.i = this.i || 0;
            const frame = spinner[this.i];
            this.i += 1;
            this.i %= spinnerFrames;

            return frame;
        };
    }

    return task[spinnerSym]();
};

/**
 * Get symbol for task.
 *
 * @param {Task} task Task.
 * @returns {string}
 */
const getSymbol = (task) => {
    if (task.isCompleted()) {
        return colors.green(symbols.tick);
    }
    if (task.isSkipped()) {
        return colors.yellow(symbols.arrowDown);
    }

    let hasSubtasks = (task.subtasks.length > 0);
    if (task.isPending()) {
        return colors.yellow(hasSubtasks ? symbols.pointer : getSpinner(task));
    }
    if (task.hasFailed()) {
        return colors.red(hasSubtasks ? symbols.pointer : symbols.cross);
    }

    return ' ';
};

const formatTime = (millis) => {
    let minutes = Math.floor(millis / 60000);
    let seconds = ((millis % 60000) / 1000).toFixed(0);
    if (!minutes) {
        return `${seconds}s`;
    }
    return `${minutes}:${`${seconds}`.padStart(2, '0')}m`;
};

/**
 * Split input into lines.
 *
 * @param {string|string[]} input Input.
 * @returns {string[]}
 */
const toLines = (input) => (Array.isArray(input) ? input.slice(0) : input.split(EOL));

/**
 * Indent lines the specified amount of times.
 *
 * @param {string|string[]} input Input.
 * @param {number} times Number of times to indent.
 * @param {string} prefix Prefix to use for indentation.
 * @returns {string[]}
 */
const indentLines = (input, times = 1, prefix = '  ') => toLines(input).map((line) => prefix.repeat(times) + line);

/**
 * Return lines to render, and an index representing how many lines should
 * be cleared upon next re-render because they may have changed.
 *
 * @param {Task[]} tasks Tasks.
 * @returns {string[]}
 */
const renderTasks = (tasks, options) =>
    tasks
        .filter((task) => task.isEnabled() && (task.isCompleted() || task.isSkipped() || task.isPending() || task.hasFailed()))
        .reduce((lines, task) => {
            let titleLine = `${getSymbol(task)} ${colors.bold(task.title)}`;
            task._started = task._started || Date.now();
            if (task.isSkipped()) {
                titleLine += ` ${colors.dim('[skipped]')}`;
            } else if (task.isCompleted()) {
                task._ended = task._ended || Date.now();
                let time = formatTime(task._ended - task._started);
                if (time !== 0) {
                    titleLine += ` ${colors.gray(`(${time})`)}`;
                }
            }
            lines.push(titleLine);

            if (typeof task.output === 'string' && task.output.trim() !== '') {
                let output = colors.gray(stripAnsi(task.output));
                lines.push(...indentLines(output));
            }

            if (task.subtasks.length > 0) {
                let subLines = renderTasks(
                    task.subtasks,
                    options,
                );
                lines.push(...indentLines(subLines));
            }

            return lines;
        }, []);

/** Custom renderer. */
module.exports = class Renderer {
    /**
     * @param {Tasks[]} tasks Tasks.
     */
    constructor(tasks) {
        this.tasks = tasks;
        this.interval = null;
        this.numLines = 0;
    }

    /** Hide cursor. */
    hideCursor() {
        process.stdout.write(cursorHide);
    }

    /** Show cursor. */
    showCursor() {
        process.stdout.write(cursorShow);
    }

    /** Worker. */
    renderWorker(done = false) {
        let lines = renderTasks(this.tasks, {});
        process.stdout.write(eraseLines(this.numLines) + lines.join(EOL));
        this.numLines = lines.length;
    }

    /** Setup renderer. */
    render() {
        if (!this.interval) {
            this.hideCursor();
            this.interval = setInterval(this.renderWorker.bind(this), 100);
        }
    }

    /** Cleanup. */
    end() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.renderWorker(true);
        process.stdout.write(EOL);
        this.showCursor();
    }
};
