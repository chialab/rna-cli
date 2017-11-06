const Spinner = require('cli-spinner').Spinner;
const colors = require('colors/safe');

/**
 * Command object.
 *
 * @param {CLI} scope Command scope (the CLI it will be run from).
 * @param {string} name Command name.
 */
function Command(scope, name) {
    this.scope = scope;
    this.name = name;
    this.options = [];
    this.help('');
}

/**
 * Setter for callback.
 *
 * @param {function} callback Callback.
 * @returns {this}
 */
Command.prototype.action = function(callback) {
    this.callback = callback;
    return this;
};

/**
 * Setter for description.
 *
 * @param {string} d Description.
 * @returns {this}
 */
Command.prototype.description = function(d) {
    this.desc = d;
    return this;
};

/**
 * Setter for help text.
 *
 * @param {function|string} callback Help text, or callable that will take care of writing help text.
 * @returns {this}
 */
Command.prototype.help = function(callback) {
    if (typeof callback === 'string') {
        // Wrap help text in a callable.
        let str = callback;
        callback = () => {
            this.scope.log('');
            this.scope.exec('help', { // Show only relevant portion of help.
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

/**
 * Add an option.
 *
 * @param {string} name Option name.
 * @param {string} description Option description.
 * @param {boolean} required Is this option required?
 * @returns {this}
 */
Command.prototype.option = function(name, description, required = false) {
    this.options.push({
        name,
        description,
        required,
    });
    return this;
};

/**
 * Run command.
 *
 * @param {Object} options Command options.
 * @returns {any}
 */
Command.prototype.exec = function(options) {
    return this.callback(this.scope, options);
};

/**
 * CLI object.
 */
function CLI() {
    this.commands = {};
    this.v = '0.0.1';
}

/**
 * Setter for version.
 *
 * @param {string} v Version.
 * @returns {this}
 */
CLI.prototype.version = function(v) {
    this.v = v;
};

/**
 * Add a new Command to the CLI.
 *
 * @param {string} name Command name.
 * @returns {Command}
 */
CLI.prototype.command = function(name) {
    this.commands[name] = new Command(this, name);
    return this.commands[name];
};

/**
 * Run a command.
 *
 * @param {string} commandName Name of the command to be executed.
 * @param {Object} options Options to be passed to command.
 * @returns {Promise}
 */
CLI.prototype.exec = function(commandName, options = {}) {
    let command = this.commands[commandName];
    if (!command) {
        // Command not found. Display help and return.
        return this.exec('help');
    }

    options.arguments = options.arguments || [];
    if (options.arguments[0] === 'help') {
        // Display help for command.
        options.arguments.shift();
        command.h(options);
        return global.Promise.resolve();
    }
    let res = command.exec(options);
    if (!(res instanceof global.Promise)) {
        // Wrap result in a resolved Promise.
        res = global.Promise.resolve(res);
    }
    return res;
};

/**
 * Store an object used to control current spinner, if any.
 *
 * @var {{stop: function, pause: function}|null}
 */
let currentLog;

/**
 * Write text to standard output (1).
 *
 * @param {string} str Text to be written.
 * @param {boolean} loading Should we display a loader?
 * @returns {function}
 */
CLI.prototype.log = function(str, loading = false) {
    if (!loading || !process.stdout.isTTY) {
        if (currentLog) {
            // Not loading, but loader running: pause it.
            currentLog.pause();
        }
        // eslint-disable-next-line
        console.log(str);
        if (currentLog) {
            // Stop current loader.
            // Why was it paused then? ~~fquffio
            currentLog();
        }

        // Return no-op for consistency.
        return () => { };
    }
    currentLog = () => {
        // Instantiate new Spinner.
        let spinner = new Spinner(str);
        spinner.setSpinnerString(17);
        spinner.start();

        // Add method to pause spinner.
        currentLog.pause = () => {
            spinner.stop(true);
        };

        // Add method to stop spinner (pause it & remove references).
        currentLog.stop = () => {
            if (currentLog) {
                currentLog.pause();
            }
            currentLog = null;
        };

        // Return only method to stop spinner: invokers won't be able to pause it.
        return currentLog.stop;
    };
    return currentLog();
};

/**
 * CLI entrypoint.
 *
 * @returns {Promise}
 */
CLI.prototype.start = function() {
    const commands = require('./args');
    let update = this.checkUpdate(); // Update check.
    let promise = global.Promise.resolve(); // Promise that will be used to launch requested commands.
    let general = commands.shift();
    if (general['-v'] || general['version']) {
        // Output version number and exit.
        this.log(this.v);
    } else if (commands.length) {
        // At least one command to be launched.
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
        // No arguments passed.
        promise = this.exec('help');
    }
    return global.Promise.all([update, promise])
        .then(() => {
            update.then((remoteVersion) => {
                if (remoteVersion && this.v !== remoteVersion) {
                    // Current version don't match with latest available one.
                    let msg = 'RNA CLI update available.';
                    let v = `(${this.v} -> ${remoteVersion})`;
                    let sep = '-------------------------------------------------------';
                    this.log('');
                    this.log(colors.grey(sep));
                    this.log('');
                    this.log(`${colors.bold(colors.cyan(msg))} ${colors.grey(v)}`);
                    this.log('$ npm install -g git+https://gitlab.com/chialab/rna-cli');
                    this.log('');
                    this.log(colors.grey(sep));
                    this.log('');
                }
            });
        })
        .catch(() => {
            promise.catch(() => {
                process.exit(1);
            });
        });
};

/**
 * Get latest available version.
 *
 * Latest available version is read from `package.json` on `master` branch.
 *
 * @returns {Promise<string>}
 */
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
