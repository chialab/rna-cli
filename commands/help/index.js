/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('help')
        .description('Show CLI help.')
        .option('[--deprecated]', 'Show deprecated commands.')
        .action((app, options) => {
            const colors = require('colors/safe');

            if (!options.lite) {
                // Display introduction unless a "lite" help was requested.
                app.log('');
                app.log(colors.bold(colors.cyan(`Welcome to ${app.name} (v${app.v})`)));
                app.log(colors.grey('"A CLI to rule them all."'));
                app.log('');
                app.log(colors.bold(colors.white('🔧  GENERAL')));
                app.log('');
                app.log(`   -v --version    ${colors.grey('Get CLI version.')}`);
                app.log(`   --verbose       ${colors.grey('Run CLI commands in verbose mode (show all logs).')}`);
                app.log(`   --profile       ${colors.grey('Profile CLI tasks.')}`);
                app.log(`   <command> help  ${colors.grey('Display a command specific help.')}`);
                app.log('');
                app.log(colors.bold(colors.white('⚡️  COMMANDS')));
                app.log('');
            }
            let names = options.commands || Object.keys(app.commands);
            // Remove deprecated unless options.deprecated === true
            names = names.filter((n) => options.deprecated || !app.commands[n].deprecated);
            let space = getNameLength(names);
            names.forEach((name) => {
                // Display command-specific help text.
                let cmd = app.commands[name];
                app.log(`${!options.lite ? '   ' : ''}${colors.cyan(name.padEnd(space))}  ${colors.grey(cmd.desc)} ${cmd.deprecated ? colors.red(`Deprecated since ${cmd.deprecated}`) : ''}`);
                let optionsHelp = defaultOptionsHelp(cmd);
                if (optionsHelp) {
                    optionsHelp.split('\n')
                        .forEach((optionHelp) => {
                            app.log(optionHelp.padStart(optionHelp.length + space + (!options.lite ? 5 : 2), ' '));
                        });
                }
                app.log('');
            });
            app.log('');
        });
};

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
    const colors = require('colors/safe');

    let options = cmd.options;
    if (options.length) {
        let length = getNameLength(options.map((cmd) => cmd.name));
        return options.map((option) => {
            let res = `${option.name.padEnd(length)}  ${colors.grey(option.description)} `;
            if (option.required) {
                res = res.bold;
            }
            return res;
        }).join('\n');
    }
    return;
}
