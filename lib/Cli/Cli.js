const path = require('path');
const parse = require('./parse');
const Command = require('./Command');
const Profiler = require('../Profiler');
const Store = require('../Store');
const { NavigatorDirectory } = require('../Navigator');
const Logger = require('../Logger');

/**
 * CLI object.
 */
class CLI {
    constructor(binName, packageName, packageVersion = '1.0.0') {
        this.bin = binName;
        this.packageName = packageName;
        this.v = packageVersion;
        this.commands = {};
        this.logger = new Logger();
        this.store = new Store(packageName);
        this.navigator = new NavigatorDirectory(
            path.resolve(__dirname, '../..'),
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

    help() {
        // Display introduction.
        this.logger.newline();
        this.logger.info(`   Welcome to ${this.bin} v${this.v}`);
        this.logger.log('   A CLI to rule them all.');
        this.logger.newline();
        this.logger.heading('   GENERAL');
        this.logger.newline();
        this.logger.log('   -v --version    Get CLI version.');
        this.logger.log('   --verbose       Run CLI commands in verbose mode (show all logs).');
        this.logger.log('   --profile       Profile CLI tasks.');
        this.logger.log('   <command> help  Display a command specific help.');
        this.logger.newline();
        this.logger.heading('   COMMANDS');
        this.logger.newline();

        let commandNames = Object.keys(this.commands);
        let space = getNameLength(commandNames);
        commandNames.forEach((name) => {
            this.helpCommand(this.commands[name], 3, space);
            this.logger.newline();
        });
        this.logger.newline();
    }

    helpCommand(command, indent = 0, space = 0) {
        space = space || command.name.length;
        // Display command-specific help text.
        this.logger.log(`${''.padStart(indent, ' ')}${command.name.padEnd(space, ' ')}  ${command.desc || ''} ${command.deprecated ? `Deprecated since ${command.deprecated}` : ''}`);
        let optionsHelp = defaultOptionsHelp(command);
        if (optionsHelp) {
            optionsHelp.split('\n')
                .forEach((optionHelp) => {
                    this.logger.log(''.padStart(indent + space + 1), optionHelp);
                });
        }
    }

    /**
     * CLI entrypoint.
     *
     * @param {Array<string>} argv A list of arguments.
     * @returns {Promise}
     */
    async start(argv) {
        let commands = parse(argv);
        let update = this.checkUpdate(); // Update check.
        this.options = commands.shift();
        if (this.options['v'] || this.options['version']) {
            // Output version number and exit.
            this.logger.log(this.v);
            return;
        } else if (this.options['help']) {
            this.help();
            return;
        } else if (commands.length === 1 && commands[0].help) {
            this.helpCommand(this.commands[commands[0]._]);
            return;
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
            let notifier = await update;
            if (notifier) {
                process.on('exit', () => {
                    this.notifyUpdate();
                });
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

    async notifyUpdate() {
        let version = this.store.get('update.remote');
        if (version !== this.v) {
            this.logger.newline();
            this.logger.log(''.padEnd(50, '-'));
            this.logger.newline();
            this.logger.info(`   ${this.bin} update available`, `${this.v} -> ${version}`);
            this.logger.newline();
            this.logger.log(`   $ npm install -g ${this.packageName}`);
            this.logger.log(`   $ yarn global add ${this.packageName}`);
            this.logger.newline();
            this.logger.log(''.padEnd(50, '-'));
            this.logger.newline();
            this.store.set('update.check', Date.now());
        }
    }

    async checkUpdate() {
        if (process.env.CI) {
            return;
        }
        let day = 24 * 60 * 60 * 1000;
        let now = Date.now();
        try {
            let remoteVersion = await this.getRemoteVersion();
            this.store.set('update.remote', remoteVersion);
        } catch (error) {
            //
        }
        let check = this.store.get('update.check') || 0;
        if (now - check < day) {
            return;
        }
        return true;
    }

    /**
     * Get latest available version.
     *
     * Latest available version is read from `package.json` on `master` branch.
     *
     * @returns {Promise<string>}
     */
    async getRemoteVersion() {
        const https = require('https');
        return await new Promise((resolve, reject) => {
            https
                .get(`https://registry.npmjs.org/${this.packageName}`, (response) => {
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

/**
 * Find length of longest string in list.
 *
 * @param {Array<string>} names List of names.
 * @returns {integer}
 */
function getNameLength(names) {
    let longest = 0;
    names.forEach((name) => {
        longest = Math.max(longest, name.length);
    });
    return longest;
}

/**
 * Display help for command.
 *
 * @param {Command} cmd Command.
 * @returns {void}
 */
function defaultOptionsHelp(cmd) {
    let options = cmd.options;
    if (options.length) {
        let length = getNameLength(options.map((cmd) => cmd.name));
        return options.map((option) => {
            let res = `${option.name.padEnd(length)}  ${option.description} `;
            if (option.required) {
                res = res.bold;
            }
            return res;
        }).join('\n');
    }
    return;
}

module.exports = CLI;
