/**
 * @see https://github.com/litixsoft/karma-detect-browsers
 */

const fs = require('fs');
const os = require('os');
const which = require('which');

const CHROME = {
    name: 'Chrome',
    DEFAULT_CMD: {
        linux: [
            'google-chrome',
            'google-chrome-stable',
        ],
        darwin: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ],
        win32: [
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.ProgramW6432}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
        ],
    },
    ENV_CMD: 'CHROME_BIN',
};

const EDGE = (() => {
    let CMD;
    try {
        CMD = require.resolve('edge-launcher/dist/x86/MicrosoftEdgeLauncher.exe');
    } catch (e) {
        CMD = '';
    }

    return {
        name: 'Edge',
        DEFAULT_CMD: {
            linux: null,
            darwin: [
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            ],
            win32: [
                `${process.env.LOCALAPPDATA}\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe`,
                `${process.env.ProgramW6432}\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe`,
                `${process.env.ProgramFiles}\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe`,
                `${process.env['ProgramFiles(X86)']}\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe`,
                CMD,
            ],
        },
        ENV_CMD: 'EDGE_BIN',
    };
})();

const FIREFOX = {
    name: 'Firefox',
    DEFAULT_CMD: {
        linux: [
            'firefox',
        ],
        darwin: [
            '/Applications/Firefox.app/Contents/MacOS/firefox-bin',
        ],
        win32: [
            `${process.env.LOCALAPPDATA}\\Mozilla Firefox\\firefox.exe`,
            `${process.env.ProgramW6432}\\Mozilla Firefox\\firefox.exe`,
            `${process.env.ProgramFiles}\\Mozilla Firefox\\firefox.exe`,
            `${process.env['ProgramFiles(x86)']}\\Mozilla Firefox\\firefox.exe`,
        ],
    },
    ENV_CMD: 'FIREFOX_BIN',
};

const IE = {
    name: 'IE',
    DEFAULT_CMD: {
        linux: null,
        darwin: null,
        win32: [
            `${process.env.ProgramW6432}\\Internet Explorer\\iexplore.exe`,
            `${process.env.ProgramFiles}\\Internet Explorer\\iexplore.exe`,
            `${process.env['ProgramFiles(x86)']}\\Internet Explorer\\iexplore.exe`,
        ],
    },
    ENV_CMD: 'IE_BIN',
};

const SAFARI = {
    name: 'Safari',
    DEFAULT_CMD: {
        linux: null,
        darwin: [
            '/Applications/Safari.app/Contents/MacOS/Safari',
        ],
        win32: null,
    },
    ENV_CMD: 'SAFARI_BIN',
};

const BROWSERS = {
    chrome: CHROME,
    edge: EDGE,
    firefox: FIREFOX,
    ie: IE,
    safari: SAFARI,
};

module.exports.CHROME = CHROME;
module.exports.EDGE = EDGE;
module.exports.FIREFOX = FIREFOX;
module.exports.IE = IE;
module.exports.SAFARI = SAFARI;
module.exports.BROWSERS = BROWSERS;
module.exports.detect = function detect() {
    let result = [];

    // iterate over all browsers in the browsers folder
    for (let browserName in BROWSERS) {
        let browser = BROWSERS[browserName],
            browserPaths = browser.DEFAULT_CMD[process.platform] || [],
            y, paths = browserPaths.length;

        if (process.env[browser.ENV_CMD] && which.sync(process.env[browser.ENV_CMD])) {
            result.push(browser.name);
            continue;
        }

        // iterate over all browser paths
        for (y = 0; y < paths; y++) {
            try {
                let browserLocated = fs.existsSync(browserPaths[y]) || which.sync(browserPaths[y]);

                // don't use Edge on operating systems other than Windows 10
                // (the launcher would be found, but would fail to run)
                let useBrowser = browser.name !== 'Edge' || process.platform === 'win32' && /^1\d/.test(os.release());

                if (browserLocated && useBrowser && result.indexOf(browser.name) < 0) {
                    // add browser when found in file system or when env variable is set
                    result.push(browser.name);

                    // set env variable on win32 when it does not exist yet
                    if (process.platform === 'win32') {
                        process.env[browser.ENV_CMD] = browserPaths[y];
                    }

                    break;
                }
            } catch (e) {
                // which.sync() failed to find the browser.
            }
        }
    }

    return result;
};
