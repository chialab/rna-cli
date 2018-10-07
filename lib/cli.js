const path = require('path');
const Spinner = require('cli-spinner').Spinner;
const colors = require('colors/safe');
const Profiler = require('./Profiler');
const Store = require('./Store');
const { NavigatorDirectory } = require('./Navigator');

/**
 * Store an object used to control current spinner, if any.
 *
 * @var {{stop: function, pause: function}|null}
 */
let currentLog;

/**
 * Command object.
 */
class Command {
    /**
     * Create a Command instance.
     *
     * @param {CLI} scope Command scope (the CLI it will be run from).
     * @param {string} name Command name.
     */
    constructor(scope, name) {
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
    action(callback) {
        this.callback = callback;
        return this;
    }

    /**
     * Setter for description.
     *
     * @param {string} d Description.
     * @returns {this}
     */
    description(d) {
        this.desc = d;
        return this;
    }

    /**
     * Setter for help text.
     *
     * @param {function|string} callback Help text, or callable that will take care of writing help text.
     * @returns {this}
     */
    help(callback) {
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
    }

    /**
     * Add an option.
     *
     * @param {string} name Option name.
     * @param {string} description Option description.
     * @param {boolean} required Is this option required?
     * @returns {this}
     */
    option(name, description, required = false) {
        this.options.push({
            name,
            description,
            required,
        });
        return this;
    }

    /**
     * Mark a command as deprecated.
     *
     * @param {String} version Since version.
     * @returns {this}
     */
    deprecate(version) {
        this.deprecated = version;
        return this;
    }
}

/**
 * CLI object.
 */
class CLI {
    constructor(name, version = '1.0.0') {
        this.name = name;
        this.v = version;
        this.commands = {};
        this.store = new Store(this.name);
        this.navigator = new NavigatorDirectory(
            path.resolve(__dirname, '..'),
        );
    }

    /**
     * Setter for version.
     *
     * @param {string} v Version.
     * @returns {this}
     */
    version(v) {
        this.v = v;
        return this;
    }

    /**
     * Add a new Command to the CLI.
     *
     * @param {string} name Command name.
     * @returns {Command}
     */
    command(name) {
        this.commands[name] = new Command(this, name);
        return this.commands[name];
    }

    /**
     * CLI entrypoint.
     *
     * @returns {Promise}
     */
    async start() {
        let commands = require('./args');
        let update = this.checkUpdate(); // Update check.
        this.options = commands.shift();
        if (this.options['v'] || this.options['version']) {
            // Output version number and exit.
            this.log(this.v);
        } else if (commands.length) {
            this.profiler = new Profiler(!!this.options.profile);

            this.profiler.on('profile', (profile) => {
                if (this.options.profile) {
                    this.log(
                        Profiler.format(profile)
                    );
                }
            });

            // At least one command to be launched.
            for (let i = 0; i < commands.length; i++) {
                let cmd = commands[i];
                let res = await this.exec(cmd._, cmd);
                if ((this.options.verbose || cmd.verbose) && res) {
                    this.log(res);
                }
            }
        } else {
            // No arguments passed.
            await this.exec('help');
        }

        try {
            let remoteVersion = await update;
            if (remoteVersion) {
                // Current version don't match with latest available one.
                let msg = 'RNA CLI update available.';
                let v = `(${this.v} -> ${remoteVersion})`;
                let sep = '-------------------------------------------------------';
                this.log('');
                this.log(colors.grey(sep));
                this.log('');
                this.log(`${colors.bold(colors.cyan(msg))} ${colors.grey(v)}`);
                this.log('$ npm install -g @chialab/rna-cli');
                this.log('$ yarn global add @chialab/rna-cli');
                this.log('');
                this.log(colors.grey(sep));
                this.log('');
            }
        } catch (err) {
            //
        }
    }

    /**
     * Run a command.
     *
     * @param {string} commandName Name of the command to be executed.
     * @param {Object} options Options to be passed to command.
     * @returns {Promise}
     */
    async exec(commandName, options = {}) {
        let command = this.commands[commandName];
        if (!command) {
            // Command not found. Display help and return.
            return await this.exec('help');
        }

        options.arguments = options.arguments || [];
        if (options.arguments[0] === 'help') {
            // Display help for command.
            options.arguments.shift();
            command.h(options);
            return;
        }

        let profile = this.profiler.task(command.name);
        // warn if deprecated
        if (command.deprecated) {
            this.log(colors.red(`${command.name} is deprecated since ${command.deprecated}`));
        }

        try {
            let fn = command.callback;
            if (typeof fn !== 'function') {
                fn = require(command.callback);
            }

            let res = await fn(this, options);
            profile.end();
            return res;
        } catch (err) {
            profile.end();
            throw err;
        }
    }

    /**
     * Write text to standard output (1).
     *
     * @param {string} str Text to be written.
     * @param {boolean} loading Should we display a loader?
     * @returns {function}
     */
    log(str, loading = false) {
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
    }

    /**
     * Get latest available version.
     *
     * Latest available version is read from `package.json` on `master` branch.
     *
     * @returns {Promise<string>}
     */
    async checkUpdate() {
        if (process.env.CI) {
            return;
        }
        const https = require('https');
        return await new Promise((resolve, reject) => {
            https
                .get('https://registry.npmjs.org/@chialab%2Frna-cli', (response) => {
                    if (response) {
                        let str = '';
                        response.on('data', (chunk) => {
                            str += chunk;
                        });
                        response.on('end', () => {
                            try {
                                let remoteJson = JSON.parse(str);
                                let version = remoteJson['dist-tags'] && remoteJson['dist-tags']['latest'];
                                if (version && this.v !== version) {
                                    resolve(version);
                                }
                                reject();
                            } catch (err) {
                                reject(err);
                            }
                        });
                    } else {
                        reject();
                    }
                })
                .on('error', (err) => reject(err))
                .end();
        });
    }
}

module.exports = CLI;
