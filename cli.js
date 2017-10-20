require('colors');
const Spinner = require('cli-spinner').Spinner;

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

CLI.prototype.log = function(str, loading = false) {
    if (!loading) {
        // eslint-disable-next-line
        return console.log(str);
    }
    let spinner = new Spinner(str);
    spinner.setSpinnerString(17);
    spinner.start();
    return () => {
        spinner.stop(true);
    };
};

CLI.prototype.start = function() {
    const argv = require('minimist')(process.argv.slice(2));
    if (argv['v'] || argv['version']) {
        this.log(this.v);
    } else {
        let cmd = argv['_'].shift();
        argv.arguments = argv['_'];
        delete argv._;
        this.exec(cmd, argv)
            .then((res) => {
                if (argv.verbose && res) {
                    this.log(res);
                }
            })
            .catch((err) => {
                if (err) {
                    this.log(err);
                }
            });
    }
};

module.exports = CLI;