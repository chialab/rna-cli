/* eslint-disable no-console */
const colors = require('colors/safe');
const { diffJson } = require('diff');

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
        console.log(...messages);
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
     * Print object diff.
     * @param {Object} obj1 The previous object.
     * @param {Object} obj2 The new object.
     * @return {void}
     */
    diff(obj1, obj2) {
        let str1 = JSON.stringify(obj1, null, 4);
        let str2 = JSON.stringify(obj2, null, 4);
        let message = diffJson(str1, str2)
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
