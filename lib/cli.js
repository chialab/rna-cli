const Spinner = require('cli-spinner').Spinner;
const colors = require('colors/safe');

function Command(scope, name) {
    this.scope = scope;
    this.name = name;
    this.options = [];
    this.help('');
}

Command.prototype.action = function(callback) {
    this.callback = callback;
    return this;
};

Command.prototype.description = function(d) {
    this.desc = d;
    return this;
};

Command.prototype.help = function(callback) {
    if (typeof callback === 'string') {
        let str = callback;
        callback = () => {
            this.scope.log('');
            this.scope.exec('help', {
                lite: true,
                commands: [this.name],
            });
            if (str) {
                this.scope.log(str);
                this.scope.log('');
            }
        };
    }
    this.h = callback;
    return this;
};

Command.prototype.option = function(name, description, required = false) {
    this.options.push({
        name,
        description,
        required,
    });
    return this;
};

Command.prototype.exec = function(options) {
    return this.callback(this.scope, options);
};

function CLI() {
    this.commands = {};
    this.v = '0.0.1';
}

CLI.prototype.version = function(v) {
    this.v = v;
};

CLI.prototype.command = function(name) {
    this.commands[name] = new Command(this, name);
    return this.commands[name];
};

CLI.prototype.exec = function(commandName, options = {}) {
    let command = this.commands[commandName];
    if (command) {
        options.arguments = options.arguments || [];
        if (options.arguments[0] === 'help') {
            options.arguments.shift();
            command.h(options);
            return global.Promise.resolve();
        }
        let res = command.exec(options);
        if (!(res instanceof global.Promise)) {
            res = global.Promise.resolve(res);
        }
        return res;
    }
    return this.exec('help');
};

let currentLog;

CLI.prototype.log = function(str, loading = false) {
    if (!loading || !process.stdout.isTTY) {
        if (currentLog) {
            currentLog.pause();
        }
        // eslint-disable-next-line
        console.log(str);
        if (currentLog) {
            currentLog();
        }
        return () => { };
    }
    currentLog = () => {
        let spinner = new Spinner(str);
        spinner.setSpinnerString(17);
        spinner.start();
        currentLog.pause = () => {
            spinner.stop(true);
        };
        currentLog.stop = () => {
            if (currentLog) {
                currentLog.pause();
            }
            currentLog = null;
        };
        return currentLog.stop;
    };
    return currentLog();
};

CLI.prototype.start = function() {
    const commands = require('./args');
    let update = this.checkUpdate();
    let promise = global.Promise.resolve();
    let general = commands.shift();
    if (general['-v'] || general['version']) {
        this.log(this.v);
    } else if (commands.length) {
        commands.forEach((cmd) => {
            promise = promise.then(() =>
                this.exec(cmd._, cmd)
                    .then((res) => {
                        if ((general.verbose || cmd.verbose) && res) {
                            this.log(res);
                        }
                    })
                    .catch((err) => {
                        if (err) {
                            this.log(err);
                        }
                        return global.Promise.reject(err);
                    })
            );
        });
    } else {
        promise = this.exec('help');
    }
    return global.Promise.all([update, promise])
        .then(() => {
            update.then((remoteVersion) => {
                if (remoteVersion && this.v !== remoteVersion) {
                    let msg = 'RNA CLI update available.';
                    let v = `(${this.v} -> ${remoteVersion})`;
                    let sep = '-------------------------------------------------------';
                    this.log('');
                    this.log(colors.grey(sep));
                    this.log(`${colors.bold(colors.cyan(msg))} ${colors.grey(v)}`);
                    this.log('$ npm install -g git+https://gitlab.com/chialab/rna-cli');
                    this.log(colors.grey(sep));
                }
            });
        })
        .catch(() => { });
};

CLI.prototype.checkUpdate = function() {
    const https = require('https');
    return new global.Promise((resolve) => {
        https.get('https://gitlab.com/chialab/rna-cli/raw/master/package.json', (response) => {
            let str = '';

            response.on('data', (chunk) => {
                str += chunk;
            });
        
            response.on('end', () => {
                let remoteJson = JSON.parse(str);
                resolve(remoteJson.version);
            });
        }).end();
    });
};

module.exports = CLI;