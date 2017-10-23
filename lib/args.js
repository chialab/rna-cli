const argv = process.argv.slice(2);
const optionRegex = /^--(?:no-)?([^\s]*)/;
const negativeOptionRegex = /^--no-/;
const pipeSep = '+';

let pipelines = {};
let lastOption;
let lastPipe;
let genericMode = true;

function openPipe(name) {
    lastPipe = pipelines[name] = pipelines[name] || {
        arguments: [],
    };
}

function closePipe() {
    if (lastOption) {
        closeOption();
    }
    lastPipe = null;
    genericMode = false;
}

function openOption(opt) {
    let defaultValue = !opt.match(negativeOptionRegex);
    let name = opt.match(optionRegex)[1];
    if (lastPipe.hasOwnProperty(name)) {
        if (!Array.isArray(lastPipe[name])) {
            defaultValue = [lastPipe[name], defaultValue];
        } else {
            defaultValue = lastPipe[name].concat([defaultValue]);
        }
    }
    lastOption = [name, defaultValue];
}

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

openPipe('_');

argv.forEach((arg) => {
    if (arg.match(optionRegex)) {
        if (lastOption) {
            closeOption();
        }
        openOption(arg);
    } else if (!lastPipe || genericMode) {
        closePipe();
        openPipe(arg);
    } else if (arg === pipeSep) {
        closePipe();
    } else if (lastOption) {
        closeOption(arg);
    } else {
        lastPipe.arguments.push(arg);
    }
});

closePipe();

module.exports = pipelines;