const fs = require('fs-extra');
const store = require('../../../../lib/store.js');

const ELECTRON = require.resolve('electron');

const defaultElectron = {
    width: 400,
    height: 300,
};

const ElectronBrowser = function(baseBrowserDecorator, args, electronOpts) {
    baseBrowserDecorator(this);

    let browserOptions = Object.assign({}, defaultElectron, electronOpts || {}, args.electronOpts || {});

    this._start = (url) => {
        const SOURCE_PATH = store.tmpdir('ElectronTest').path;
        const STATIC_PATH = store.tmpdir('ElectronTest').path;
        const MAIN_JS = SOURCE_PATH.file('main.js').path;

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
        darwin: require(ELECTRON),
        linux: require(ELECTRON),
        win32: require(ELECTRON),
    },

    ENV_CMD: 'ELECTRON_BIN',
};

ElectronBrowser.$inject = ['baseBrowserDecorator', 'args', 'config.electronOpts'];

// PUBLISH DI MODULE
module.exports = {
    'launcher:Electron': ['type', ElectronBrowser],
};
