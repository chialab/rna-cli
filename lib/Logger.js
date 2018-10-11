/* eslint-disable no-console */
const Spinner = require('cli-spinner').Spinner;
const colors = require('colors/safe');

class Log {
    constructor(message) {
        this.spinner = new Spinner(message);
        this.spinner.setSpinnerString(17);
    }

    play() {
        this.spinner.start();
    }

    pause() {
        this.spinner.stop(true);
    }

    stop() {
        this.pause();
    }
}

class Logger {
    constructor() {
        this.isTTY = process.stdout.isTTY;
    }

    log(...messages) {
        if (this.currentSpinner) {
            this.currentSpinner.pause();
        }
        console.log(...messages);
        if (this.currentSpinner) {
            this.currentSpinner.play();
        }
    }

    newline() {
        return this.log('');
    }

    info(message, extras) {
        return this.log(colors.cyan(message), extras ? colors.gray(`(${extras})`) : '');
    }

    success(message, extras) {
        return this.log(colors.bold(colors.green(message)), extras ? colors.gray(`(${extras})`) : '');
    }

    warn(message, extras) {
        return this.log(colors.yellow(message), extras ? colors.gray(`(${extras})`) : '');
    }

    error(message, extras) {
        return this.log(colors.red(message), extras ? colors.gray(`(${extras})`) : '');
    }

    heading(message) {
        return this.log(colors.bold(colors.white(message)));
    }

    play(message, extras) {
        this.stop();
        this.currentSpinner = new Log(`${message} ${extras ? colors.gray(`(${extras})`) : ''}`);
        this.currentSpinner.play();
    }

    stop() {
        if (this.currentSpinner) {
            this.currentSpinner.stop();
            delete this.currentSpinner;
        }
    }
}

module.exports = Logger;
