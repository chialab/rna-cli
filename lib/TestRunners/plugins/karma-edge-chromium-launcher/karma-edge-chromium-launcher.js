/**
 * @author ChiragRupani
 * @see https://github.com/ChiragRupani/karma-chromiumedge-launcher
 * @see https://github.com/ChiragRupani/karma-chromiumedge-launcher/issues/2
 */

const fs = require('fs');
const path = require('path');
const which = require('which');
class Utilities {
    static GetBin(commands) {
        // // Only run these checks on Linux
        if (process.platform !== 'linux') {
            return null;
        }
        let bin = '';
        for (let i = 0; i < commands.length; i++) {
            try {
                if (which.sync(commands[i])) {
                    bin = commands[i];
                    break;
                }
            } catch (e) {
                //
            }
        }
        return bin;
    }
    static GetEdgeDarwin(defaultPath) {
        if (process.platform !== 'darwin') {
            return null;
        }
        try {
            let homePath = path.join(process.env.HOME, defaultPath);
            fs.accessSync(homePath);
            return homePath;
        } catch (e) {
            return defaultPath;
        }
    }
    // Return location of Edge.exe file for a given directory.
    static GetEdgeExe(edgeDirName) {
        // Only run these checks on win32
        if (process.platform !== 'win32') {
            return null;
        }
        let suffix = `\\\\Microsoft\\\\${edgeDirName}\\\\Application\\\\msedge.exe`;
        let prefixes = [
            process.env['PROGRAMFILES(X86)'],
            process.env.PROGRAMFILES,
            process.env.LOCALAPPDATA,
        ];
        let edgePath = '';
        for (let i = 0; i < prefixes.length; i++) {
            try {
                let windowsEdgeDirectory = path.join(prefixes[i], suffix);
                fs.accessSync(windowsEdgeDirectory);
                edgePath = windowsEdgeDirectory;
                break;
            } catch (e) {
                //
            }
        }
        return edgePath;
    }
    static isJSFlags(flag) {
        return flag.indexOf('--js-flags=') === 0;
    }
    static sanitizeJSFlags(flag) {
        let test = /--js-flags=(['"])/.exec(flag);
        if (!test) {
            return flag;
        }
        let escapeChar = test[1];
        let endExp = new RegExp(`${escapeChar}$`);
        let startExp = new RegExp(`--js-flags=${escapeChar}`);
        return flag.replace(startExp, '--js-flags=').replace(endExp, '');
    }
}

class BaseBrowser {
    constructor(flags, userDataDir) {
        this.flags = flags;
        this.userDataDir = userDataDir;
        this._getOptions = this._getOptions.bind(this);
        this._getHeadlessOptions = this._getHeadlessOptions.bind(this);
    }
    _getOptions(url) {
        // Chrome CLI options - http://peter.sh/experiments/chromium-command-line-switches/
        this.flags.forEach((flag, i) => {
            if (Utilities.isJSFlags(flag)) {
                this.flags[i] = Utilities.sanitizeJSFlags(flag);
            }
        });
        let allflags = [
            `--user-data-dir=${this.userDataDir}`,
            // https://github.com/GoogleChrome/chrome-launcher/blob/master/docs/chrome-flags-for-tools.md#--enable-automation
            '--enable-automation',
            '--no-default-browser-check',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-translate',
            '--disable-background-timer-throttling',
            // on macOS, disable-background-timer-throttling is not enough
            // and we need disable-renderer-backgrounding too
            // see https://github.com/karma-runner/karma-chrome-launcher/issues/123
            '--disable-renderer-backgrounding',
            '--disable-device-discovery-notifications',
        ].concat(this.flags, [url]);
        return allflags;
    }
    _getHeadlessOptions(url) {
        let mergedArgs = this._getOptions(url).concat([
            // Headless not working on NodeJS
            // '--headless',
            '--no-proxy-server',
            // '--disable-gpu'
        ]);
        let args;
        if (mergedArgs.some(f => f.indexOf('--remote-debugging-port=') !== -1)) {
            args = mergedArgs;
        } else {
            args = mergedArgs.concat(['--remote-debugging-port=9222']);
        }
        return args;
    }
}

const EdgeBetaBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getOptions;
};
EdgeBetaBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeBetaBrowser.prototype = {
    name: 'Edge Beta',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta'),
        win32: Utilities.GetEdgeExe('Edge Beta'),
    },
    ENV_CMD: 'EDGE_Beta_BIN',
};

const EdgeCanaryBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getOptions;
};
EdgeCanaryBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeCanaryBrowser.prototype = {
    name: 'Edge Canary',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary'),
        win32: Utilities.GetEdgeExe('Edge SxS'),
    },
    ENV_CMD: 'EDGE_CANARY_BIN',
};

const EdgeDevBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getOptions;
};
EdgeDevBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeDevBrowser.prototype = {
    name: 'Edge Dev',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev'),
        win32: Utilities.GetEdgeExe('Edge Dev'),
    },
    ENV_CMD: 'EDGE_DEV_BIN',
};

const EdgeStableBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getOptions;
};
EdgeStableBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeStableBrowser.prototype = {
    name: 'Edge',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
        win32: Utilities.GetEdgeExe('Edge'),
    },
    ENV_CMD: 'EDGE_BIN',
};

const EdgeBetaHeadlessBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getHeadlessOptions;
};
EdgeBetaHeadlessBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeBetaHeadlessBrowser.prototype = {
    name: 'Edge Beta Headless',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta'),
        win32: Utilities.GetEdgeExe('Edge Beta'),
    },
    ENV_CMD: 'EDGE_Beta_BIN',
};

const EdgeCanaryHeadlessBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getHeadlessOptions;
};
EdgeCanaryHeadlessBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeCanaryHeadlessBrowser.prototype = {
    name: 'Edge Canary Headless',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary'),
        win32: Utilities.GetEdgeExe('Edge SxS'),
    },
    ENV_CMD: 'EDGE_CANARY_BIN',
};

const EdgeDevHeadlessBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getHeadlessOptions;
};
EdgeDevHeadlessBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeDevHeadlessBrowser.prototype = {
    name: 'Edge Dev Headless',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev'),
        win32: Utilities.GetEdgeExe('Edge Dev'),
    },
    ENV_CMD: 'EDGE_DEV_BIN',
};

const EdgeStableHeadlessBrowser = function(baseBrowserDecorator, args) {
    baseBrowserDecorator(this);
    let flags = args.flags || [];
    let userDataDir = args.edgeDataDir || this._tempDir;
    let browser = new BaseBrowser(flags, userDataDir);
    this._getOptions = browser._getHeadlessOptions;
};
EdgeStableHeadlessBrowser.$inject = ['baseBrowserDecorator', 'args'];
EdgeStableHeadlessBrowser.prototype = {
    name: 'Edge Headless',
    DEFAULT_CMD: {
        linux: null,
        darwin: Utilities.GetEdgeDarwin('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
        win32: Utilities.GetEdgeExe('Edge'),
    },
    ENV_CMD: 'EDGE_BIN',
};

const EdgeLegacyBrowser = function(baseBrowserDecorator, logger) {
    const exec = require('child_process').exec;
    baseBrowserDecorator(this);
    let log = logger.create('launcher');

    function killEdgeProcess(cb) {
        exec('taskkill /t /f /im MicrosoftEdge.exe', (err) => {
            if (err) {
                log.error(`Killing Edge process failed. ${err}`);
            } else {
                log.debug('Killed Edge process');
            }
            cb();
        });
    }

    this._getOptions = (url) => [url, '-k'];

    let baseOnProcessExit = this._onProcessExit;
    this._onProcessExit = (code, errorOutput) => {
        killEdgeProcess(() => {
            if (baseOnProcessExit) {
                baseOnProcessExit(code, errorOutput);
            }
        });
    };
};

EdgeLegacyBrowser.prototype = {
    name: 'Edge',
    DEFAULT_CMD: {
        win32: require.resolve('edge-launcher/dist/x86/MicrosoftEdgeLauncher.exe'),
    },
    ENV_CMD: 'EDGE_BIN',
};

EdgeLegacyBrowser.$inject = ['baseBrowserDecorator', 'logger'];

module.exports = {
    'launcher:EdgeDev': ['type', EdgeDevBrowser],
    'launcher:EdgeCanary': ['type', EdgeCanaryBrowser],
    'launcher:EdgeBeta': ['type', EdgeBetaBrowser],
    'launcher:Edge': ['type', EdgeStableBrowser],
    'launcher:EdgeLegacy': ['type', EdgeLegacyBrowser],
    // Headless
    'launcher:EdgeHeadless': ['type', EdgeStableHeadlessBrowser],
    'launcher:EdgeDevHeadless': ['type', EdgeDevHeadlessBrowser],
    'launcher:EdgeBetaHeadless': ['type', EdgeBetaHeadlessBrowser],
    'launcher:EdgeCanaryHeadless': ['type', EdgeCanaryHeadlessBrowser],
};
