/* eslint-disable no-console */
const Spinner = require('cli-spinner').Spinner;
const colors = require('colors/safe');

/**
 * @class SpinnerLog
 * Create a log with a spinner.
 */
class SpinnerLog {
    /**
     * Create a SpinnerLog.
     * @param {string} message The log message.
     * @return {SpinnerLog}
     */
    constructor(message) {
        this.spinner = new Spinner(message);
        this.spinner.setSpinnerString(17);
    }

    /**
     * Run the spinner.
     * @return {void}
     */
    play() {
        this.spinner.start();
    }

    /**
     * Stop the spinner.
     * @return {void}
     */
    stop() {
        this.spinner.stop(true);
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
        return this.log('');
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
        return this.log(colors.bold(colors.white(message)));
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
}

module.exports = Logger;
