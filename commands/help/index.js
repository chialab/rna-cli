const colors = require('colors/safe');

function getNameLength(names) {
    let longest = 0;
    names.forEach((name) => {
        longest = Math.max(longest, name.length);
    });
    return longest;
}

function formatName(name, space) {
    while (name.length !== space) {
        name += ' ';
    }
    name += ' ';
    return name;
}

function defaultOptionsHelp(cmd) {
    let options = cmd.options;
    if (options.length) {
        let length = getNameLength(options.map((cmd) => cmd.name));
        return options.map((option) => {
            let res = `${formatName(option.name, length)} ${option.description.grey}`;
            if (option.required) {
                res = res.bold;
            }
            return res;
        }).join('\n');
    }
    return;
}

module.exports = (program) => {
    program
        .command('help')
        .description('Show CLI help.')
        .action((app, options) => {
            if (!options.lite) {
                app.log('');
                app.log(colors.bold(colors.cyan(`Welcome to RNA CLI (v${app.v})`)));
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
        });
};