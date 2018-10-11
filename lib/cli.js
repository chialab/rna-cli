const path = require('path');
const Profiler = require('./Profiler');
const Store = require('./Store');
const { NavigatorDirectory } = require('./Navigator');
const Logger = require('./Logger');

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
                this.scope.logger.newline();
                this.scope.exec('help', { // Show only relevant portion of help.
                    lite: true,
                    commands: [this.name],
                });
                if (str) {
                    this.scope.logger.log(str);
                    this.scope.logger.newline();
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
        this.logger = new Logger();
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
            this.logger.log(this.v);
        } else if (commands.length) {
            this.profiler = new Profiler(!!this.options.profile);

            this.profiler.on('profile', (profile) => {
                if (this.options.profile) {
                    this.logger.log(Profiler.format(profile));
                }
            });

            // At least one command to be launched.
            for (let i = 0; i < commands.length; i++) {
                let cmd = commands[i];
                let res = await this.exec(cmd._, cmd);
                if ((this.options.verbose || cmd.verbose) && res) {
                    this.logger.log(res);
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
                this.logger.newline();
                this.logger.log(sep);
                this.logger.newline();
                this.logger.info(msg, v);
                this.logger.log('$ npm install -g @chialab/rna-cli');
                this.logger.log('$ yarn global add @chialab/rna-cli');
                this.logger.newline();
                this.logger.log(sep);
                this.logger.newline();
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
            this.logger.error(`${command.name} is deprecated since ${command.deprecated}`);
        }

        try {
            const res = await command.callback(this, options);
            profile.end();
            return res;
        } catch (err) {
            profile.end();
            throw err;
        }
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
