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
                app.log(`Welcome to RNA CLI (v${app.v})`.cyan.bold);
                app.log('');
                app.log('🔧  GENERAL'.white.bold);
                app.log('');
                app.log(`   -v --version    ${'Get CLI version.'.grey}`);
                app.log(`   --verbose       ${'Run CLI commands in verbose mode (show all logs).'.grey}`);
                app.log(`   [command] help  ${'Display a command specific help.'.grey}`);
                app.log('');
                app.log('⚡️  COMMANDS'.white.bold);
                app.log('');
            }
            let names = options.commands || Object.keys(app.commands);
            let space = getNameLength(names);
            names.forEach((name) => {
                let cmd = app.commands[name];
                app.log(`${!options.lite ? '   ' : ''}${formatName(name, space).cyan} ${cmd.desc.grey}`);
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