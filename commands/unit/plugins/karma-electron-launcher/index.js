const fs = require('fs-extra');
const path = require('path');

const ElectronBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);

    let electronOpts = args.electronOpts || {};

    let browserOptions = Object.assign({}, {
        width: 400,
        height: 300,
    }, electronOpts || {}, args.electronOpts || {});

    this._start = (url) => {
        fs.ensureDirSync(args.tmpdir);

        let SOURCE_PATH = path.join(__dirname, 'ElectronTest');
        let STATIC_PATH = args.tmpdir;
        let MAIN_JS = path.join(args.tmpdir, 'main.js');

        fs.copySync(SOURCE_PATH, STATIC_PATH);
        let content = fs.readFileSync(MAIN_JS, 'utf8')
            .replace('%URL%', url)
            .replace('\'%OPTS%\'', JSON.stringify(browserOptions));
        fs.writeFileSync(MAIN_JS, content);
        this._execCommand(this._getCommand(), [STATIC_PATH]);
    };
};

ElectronBrowser.prototype = {
    name: 'electron',

    DEFAULT_CMD: {
        darwin: 'electron',
        linux: 'electron',
        win32: 'electron',
    },

    ENV_CMD: 'ELECTRON_BIN',
};

ElectronBrowser.$inject = ['baseBrowserDecorator', 'args'];

// PUBLISH DI MODULE
module.exports = {
    'launcher:Electron': ['type', ElectronBrowser],
};
