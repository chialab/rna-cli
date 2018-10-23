const path = require('path');
const marked = require('marked');
const TerminalRenderer = require('marked-terminal');
const parse = require('./parse');
const Command = require('./Command');
const Profiler = require('../Profiler');
const Store = require('../Store');
const { NavigatorDirectory } = require('../Navigator');
const Logger = require('../Logger');

// setup a terminal renderer for markdown.
marked.setOptions({
    // Define custom renderer
    renderer: new TerminalRenderer(),
});

/**
 * CLI object.
 */
class CLI {
    /**
     * Create a CLI instance.
     *
     * @param {string} binName The name of the CLI bin file.
     * @param {string} packageName The name of the NPM package.
     * @param {string} packageVersion The name of the NPM package version.
     * @return {CLI}
     */
    constructor(binName, packageName, packageVersion = '1.0.0') {
        this.bin = binName;
        this.packageName = packageName;
        this.v = packageVersion;
        this.commands = {};
        // create a logger instance for the CLI
        this.logger = new Logger();
        // create a store instance for the CLI
        this.store = new Store(packageName);
        // create a project navigator for the CLI
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
        this.commands[name] = new Command(name);
        return this.commands[name];
    }

    /**
     * Print CLI help.
     * @return {void}
     */
    help() {
        // Display introduction.
        this.logger.newline();
        this.logger.info(`   Welcome to ${this.bin} v${this.v}`);
        this.logger.log('   A CLI to rule them all.');
        this.logger.newline();
        this.logger.heading('   GENERAL');
        this.logger.newline();
        this.logger.log('   -v --version    Get CLI version.');
        this.logger.log('   --profile       Profile CLI tasks.');
        this.logger.log('   <command> help  Display a command specific help.');
        this.logger.newline();
        this.logger.heading('   COMMANDS');
        this.logger.newline();

        // print commands helps
        let commandNames = Object.keys(this.commands);
        let padding = getNameLength(commandNames);
        commandNames.forEach((name) => {
            // Display command-specific help text.
            let command = this.commands[name];
            this.logger.log(`   ${command.name.padEnd(padding, ' ')}  ${command.desc || ''} ${command.deprecated ? `Deprecated since ${command.deprecated}${command.deprecatedMessage ? ` - ${command.deprecatedMessage}` : ''}` : ''}`);
            let optionsHelp = defaultOptionsHelp(command);
            if (optionsHelp) {
                optionsHelp.split('\n')
                    .forEach((optionHelp) => {
                        this.logger.log(''.padStart(padding + 4), optionHelp);
                    });
            }
            this.logger.newline();
        });
        this.logger.newline();
    }

    /**
     * Print command help.
     *
     * @param {Command} command A command instance.
     * @return {void}
     */
    helpCommand(command) {
        // Display command-specific help text.
        this.logger.newline();
        this.logger.log(marked(command.helpContent || ''));
    }

    /**
     * CLI entrypoint.
     *
     * @param {Array<string>} argv A list of arguments.
     * @returns {Promise}
     */
    async start(argv) {
        // if beta version, notify the user
        if (!this.isStableVersion()) {
            this.logger.warn('RNA CLI beta version detected.');
        }
        let commands = parse(argv);
        let update = this.checkUpdate(); // Update check.
        this.options = commands.shift();
        if (this.options['v'] || this.options['version']) {
            // Output version number and exit.
            this.logger.log(this.v);
            return;
        } else if (this.options['help'] || !commands.length) {
            // show CLI help
            this.help();
            return;
        } else if (commands.length === 1 && commands[0].help) {
            // show command help
            this.helpCommand(this.commands[commands[0]._]);
            return;
        } else if (commands.length) {
            // start a profiler instance for each command to execute
            this.profiler = new Profiler(!!this.options.profile);
            this.profiler.on('profile', (profile) => {
                if (this.options.profile) {
                    this.logger.log(Profiler.format(profile));
                }
            });

            for (let i = 0; i < commands.length; i++) {
                let cmd = commands[i];
                // execute the command
                await this.exec(this.commands[cmd._], cmd);
            }
        }

        try {
            // check if should notify an update.
            let notifier = await update;
            if (notifier) {
                process.on('exit', () => {
                    this.notifyUpdate();
                });
            }
        } catch (err) {
            // if the update check fails, ignore it.
        }
    }

    /**
     * Run a command.
     *
     * @param {Command} command The command to be executed.
     * @param {Object} options Options to be passed to command.
     * @returns {Promise}
     */
    async exec(command, options = {}) {
        if (!command || !command.name) {
            this.help();
            return;
        }

        let profile = this.profiler.task(command.name);
        // warn if deprecated
        if (command.deprecated) {
            this.logger.warn(`${command.name} is deprecated since ${command.deprecated}${command.deprecatedMessage ? ` - ${command.deprecatedMessage}` : ''}`);
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
     * Notify an available update.
     * @return {void}
     */
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

    /**
     * Check for an update.
     * @return {Promise<boolean>} Resolve true if an update is available.
     */
    async checkUpdate() {
        if (process.env.CI) {
            // skip the check in CI environments.
            return false;
        }
        if (!this.isStableVersion()) {
            // skip for beta releases.
            return false;
        }
        let day = 24 * 60 * 60 * 1000;
        let now = Date.now();
        let check = this.store.get('update.check') || 0;
        if (now - check < day) {
            // check once a day
            return;
        }
        try {
            // store the remote version of the CLI package.
            let remoteVersion = await this.getRemoteVersion();
            this.store.set('update.remote', remoteVersion);
            return remoteVersion !== this.v;
        } catch (error) {
            // failed to fetch remote package.json, ignore it
        }
        return false;
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

    /**
     * Return true if given version number is considered stable.
     * @return {boolean}
     */
    isStableVersion() {
        // stable version are considered like 'x.y.z'
        return /^\d+\.\d+\.\d+$/.test(this.v);
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
