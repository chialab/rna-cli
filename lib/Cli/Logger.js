/* eslint-disable no-console */
const readline = require('readline');
const colors = require('colors/safe');
const { diffJson } = require('diff');

/**
 * @class SpinnerLog
 * Create a log with a spinner.
 */
class SpinnerLog {
    /**
     * Create a SpinnerLog.
     * @param {string} message The log message.
     */
    constructor(message) {
        this.message = message;
        this.chars = '☱☲☴';
    }

    /**
     * Run the spinner.
     * @return {void}
     */
    play() {
        let current = 0;
        const iteration = () => {
            this.print(`${this.chars[current]} ${this.message}`);
            current = ++current % this.chars.length;
        };

        iteration();
        this.interval = setInterval(iteration, 60);
    }

    /**
     * Clear the current line in console buffer.
     * @return {void}
     */
    clearLine() {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    }

    /**
     * Print a message in console buffer.
     * @param {string} message The message to print.
     * @return {void}
     */
    print(message) {
        this.clearLine();
        process.stdout.write(message);
    }

    /**
     * Check if spinner is active.
     * @return {boolean}
     */
    isPlaying() {
        return !!this.interval;
    }

    /**
     * Stop the spinner.
     * @return {void}
     */
    stop() {
        if (!this.isPlaying) {
            return;
        }
        clearInterval(this.interval);
        this.interval = null;
        this.clearLine();
    }
}

/**
 * @class Logger
 * Create a Logger helper for CLI.
 *
 * @property {boolean} isTTY
 */
class Logger {
    /**
     * Create a Logger instance.
     * @return {Logger}
     */
    constructor() {
        this.isTTY = process.stdout.isTTY && !process.env.CI;
    }

    /**
     * Log messages.
     * @param {...string} messages A list of messages to stdout.
     * @return {void}
     */
    log(...messages) {
        if (this.currentSpinner) {
            // stop the current spinner before print new logs.
            this.currentSpinner.stop();
        }
        console.log(...messages);
        if (this.currentSpinner) {
            // restart the spinner if it was running before the logs.
            this.currentSpinner.play();
        }
    }

    /**
     * Print a newline.
     * @return {void}
     */
    newline() {
        return this.log(colors.reset(' '));
    }

    /**
     * Print an info message.
     * The main message will be printed using cyan color.
     * Extra content will be gray and wrapped by parens.
     * @param {string} message The main message.
     * @param {string} extras The extra message.
     * @return {void}
     */
    info(message, extras) {
        return this.log(colors.cyan(message), extras ? colors.gray(`(${extras})`) : '');
    }

    /**
     * Print a success message.
     * The main message will be printed using green color.
     * Extra content will be gray and wrapped by parens.
     * @param {string} message The main message.
     * @param {string} extras The extra message.
     * @return {void}
     */
    success(message, extras) {
        return this.log(colors.bold(colors.green(message)), extras ? colors.gray(`(${extras})`) : '');
    }

    /**
     * Print a warning message.
     * The main message will be printed using yellow color.
     * Extra content will be gray and wrapped by parens.
     * @param {string} message The main message.
     * @param {string} extras The extra message.
     * @return {void}
     */
    warn(message, extras) {
        return this.log(colors.yellow(message), extras ? colors.gray(`(${extras})`) : '');
    }

    /**
     * Print an error message.
     * The main message will be printed using red color.
     * Extra content will be gray and wrapped by parens.
     * @param {string} message The main message.
     * @param {string} extras The extra message.
     * @return {void}
     */
    error(message, extras) {
        return this.log(colors.red(message), extras ? colors.gray(`(${extras})`) : '');
    }

    /**
     * Print a heading.
     * @param {string} message The main message.
     * @param {string} extras The extra message.
     * @return {void}
     */
    heading(message) {
        return this.log(colors.bold(colors.cyan(message)));
    }

    /**
     * Start a spinner log.
     * Extra content will be gray and wrapped by parens.
     * @param {string} message The main message.
     * @param {string} extras The extra message.
     * @return {void}
     */
    play(message, extras) {
        this.stop();
        if (!this.isTTY) {
            this.info(message, extras);
            return;
        }
        this.currentSpinner = new SpinnerLog(`${message} ${extras ? colors.gray(`(${extras})`) : ''}`);
        this.currentSpinner.play();
    }

    /**
     * Stop the current spinner log.
     * @return {void}
     */
    stop() {
        if (!this.currentSpinner) {
            return;
        }
        this.currentSpinner.stop();
        delete this.currentSpinner;
    }

    /**
     * Print object diff.
     * @param {Object} obj1 The previous object.
     * @param {Object} obj2 The new object.
     * @return {void}
     */
    diff(obj1, obj2) {
        const str1 = JSON.stringify(obj1, null, 4);
        const str2 = JSON.stringify(obj2, null, 4);
        const message = diffJson(str1, str2)
            .map((entry) => {
                if (entry.removed) {
                    return colors.red(entry.value);
                } else if (entry.added) {
                    return colors.green(entry.value);
                }
                return entry.value;
            }).join('');
        this.log(message);
    }
}

module.exports = Logger;
