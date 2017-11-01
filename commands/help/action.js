const colors = require('colors/safe');

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
 * Right-pad a string to a desired length with whitespaces. And add a bonus whitespace for the folks at home.
 *
 * @param {string} name String to be padded.
 * @param {integer} space Desired length.
 * @returns {string}
 */
function formatName(name, space) {
    while (name.length !== space) {
        name += ' ';
    }
    name += ' ';
    return name;
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
            let res = `${formatName(option.name, length)} ${colors.grey(option.description)}`;
            if (option.required) {
                res = res.bold;
            }
            return res;
        }).join('\n');
    }
    return;
}

/**
 * Command action to display help text.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {void}
 */
module.exports = (app, options) => {
    if (!options.lite) {
        // Display introduction unless a "lite" help was requested.
        app.log('');
        app.log(colors.bold(colors.cyan(`Welcome to RNA CLI (v${app.v})`)));
        app.log(colors.grey('"A CLI to rule them all."'));
        app.log('');
        app.log(colors.bold(colors.white('🔧  GENERAL')));
        app.log('');
        app.log(`   -v --version    ${colors.grey('Get CLI version.')}`);
        app.log(`   --verbose       ${colors.grey('Run CLI commands in verbose mode (show all logs).')}`);
        app.log(`   [command] help  ${colors.grey('Display a command specific help.')}`);
        app.log('');
        app.log(colors.bold(colors.white('⚡️  COMMANDS')));
        app.log('');
    }
    let names = options.commands || Object.keys(app.commands);
    let space = getNameLength(names);
    names.forEach((name) => {
        // Display command-specific help text.
        let cmd = app.commands[name];
        app.log(`${!options.lite ? '   ' : ''}${colors.cyan(formatName(name, space))} ${colors.grey(cmd.desc)}`);
        let h = defaultOptionsHelp(cmd);
        if (h) {
            app.log(`
${h.replace(/^/gm, formatName('', space + (!options.lite ? 4 : 0)))}
`);
        }
    });
    app.log('');
};
