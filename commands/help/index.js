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
            if (!options.lite) {
                // Display introduction unless a "lite" help was requested.
                app.logger.newline();
                app.logger.info(`   Welcome to ${app.bin} v${app.v}`);
                app.logger.log('   A CLI to rule them all.');
                app.logger.newline();
                app.logger.heading('   GENERAL');
                app.logger.newline();
                app.logger.log('   -v --version    Get CLI version.');
                app.logger.log('   --verbose       Run CLI commands in verbose mode (show all logs).');
                app.logger.log('   --profile       Profile CLI tasks.');
                app.logger.log('   <command> help  Display a command specific help.');
                app.logger.newline();
                app.logger.heading('   COMMANDS');
                app.logger.newline();
            }
            let names = options.commands || Object.keys(app.commands);
            // Remove deprecated unless options.deprecated === true
            names = names.filter((n) => options.deprecated || !app.commands[n].deprecated);
            let space = getNameLength(names);
            names.forEach((name) => {
                // Display command-specific help text.
                let cmd = app.commands[name];
                app.logger.log(`${!options.lite ? '   ' : ''}${name.padEnd(space)}  ${cmd.desc || ''} ${cmd.deprecated ? `Deprecated since ${cmd.deprecated}` : ''}`);
                let optionsHelp = defaultOptionsHelp(cmd);
                if (optionsHelp) {
                    optionsHelp.split('\n')
                        .forEach((optionHelp) => {
                            app.logger.log(optionHelp.padStart(optionHelp.length + space + (!options.lite ? 5 : 2), ' '));
                        });
                }
                app.logger.newline();
            });
            app.logger.newline();
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
