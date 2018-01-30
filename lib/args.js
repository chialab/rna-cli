const argv = process.argv.slice(2);
const optionRegex = /^-(-|\w)(?:no-)?([^\s]*)=?/;
const negativeOptionRegex = /^--no-/;
const pipeSep = '+';

/**
 * Commands to be executed in parallel.
 *
 * @var {Array<{_: string, arguments: Array<string>, [x: string]: string|Array<string>}>}
 */
let pipelines = [];
let lastOption;
let lastPipe;
let genericMode = true;

/**
 * Add a new command to be executed in parallel.
 *
 * @param {string} name Command name.
 * @returns {void}
 */
function openPipe(name) {
    lastPipe = {
        _: name,
        arguments: [],
    };
    pipelines.push(lastPipe);
}

/**
 * Complete command to be executed in parallel.
 *
 * @returns {void}
 */
function closePipe() {
    if (lastOption) {
        closeOption();
    }
    lastPipe = null;
    genericMode = false;
}

/**
 * Add option value.
 *
 * @param {string} opt Option name.
 * @returns {void}
 */
function openOption(opt) {
    let defaultValue = !opt.match(negativeOptionRegex);
    let match = opt.match(optionRegex);
    let name = match[2] || match[1];
    if (lastPipe.hasOwnProperty(name)) {
        // Append value to array.
        if (!Array.isArray(lastPipe[name])) {
            defaultValue = [lastPipe[name], defaultValue];
        } else {
            defaultValue = lastPipe[name].concat([defaultValue]);
        }
    }
    lastOption = [name, defaultValue];
}

/**
 * Complete option.
 *
 * @param {string} val Last option value.
 * @returns {void}
 */
function closeOption(val) {
    let name = lastOption[0];
    let current = lastOption[1];
    if (val !== undefined) {
        if (Array.isArray(current)) {
            current[current.length - 1] = val;
        } else {
            current = val;
        }
    }
    lastPipe[name] = current;
    lastOption = null;
}

// This is not a real command, but rather a bucket generic options will be stored.
openPipe('_');

let args = [];

argv.forEach((arg) => {
    if (arg[0] === '-' && arg.includes('=')) {
        let splitted = arg.split('=');
        args.push(splitted.shift(), splitted.join('='));
    } else {
        args.push(arg);
    }
});

args.forEach((arg) => {
    if (arg.match(optionRegex)) {
        // New option encountered.
        if (lastOption) {
            // Nothing more to add to last encountered option.
            closeOption();
        }
        openOption(arg);
    } else if (!lastPipe || genericMode) {
        // New command.
        closePipe();
        openPipe(arg);
    } else if (arg === pipeSep) {
        // Separator: done with last command.
        closePipe();
    } else if (lastOption) {
        // Option value.
        closeOption(arg);
    } else {
        // Command argument.
        lastPipe.arguments.push(arg);
    }
});

// Close everything pending.
closePipe();

module.exports = pipelines;
