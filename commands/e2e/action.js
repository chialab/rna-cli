const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../lib/paths.js');
const nightwatch = require('nightwatch');

/**
 * Convert browsers nicknames into the Selenium name.
 * @param {String} browserName The browser nickname to convert.
 * @param {Object} config The generic configuration.
 * @return {Object} The final configuration
 */
function getBrowserConfig(browserName, config) {
    switch (browserName) {
        case 'chrome': {
            config.browserName = 'chrome';
            config.chromeOptions = {
                args: ['--no-sandbox', '--disable-web-security'],
                prefs: {
                    'intl.accept_languages': 'en',
                },
            };
            break;
        }
        case 'firefox': {
            config.browserName = 'firefox';
            config.firefoxOptions = {
                prefs: {
                    'intl.accept_languages': 'en',
                },
            };
            break;
        }
        case 'edge': {
            config.browserName = 'MicrosoftEdge';
            break;
        }
        case 'ie': {
            config.browserName = 'internet explorer';
            break;
        }
        default: {
            config.browserName = browserName;
            break;
        }
    }
    return config;
}

/**
 * Get Nighwatch configuration.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
function getConfig(app, options) {
    let localConf = path.join(paths.cwd, 'nightwatch.json');
    if (fs.existsSync(localConf)) {
        // Local Nighwatch config exists. Use that.
        return global.Promise.resolve(require(localConf));
    }
    if (!options.url) {
        return global.Promise.reject('Missing `url` option.');
    }
    if (!options.browser) {
        return global.Promise.reject('Missing `browser` option.');
    }
    let seleniumHost = options['selenium.host'] || 'localhost';
    let seleniumPort = options['selenium.port'] || 4444;
    let screenshotsPath;
    if (options.screenshots) {
        if (typeof options.screenshots === 'string') {
            screenshotsPath = options.screenshots;
        } else {
            screenshotsPath = 'test/screenshots/e2e';
        }
    }
    return global.Promise.resolve({
        src_folders: options.arguments.length ? options.arguments : ['test/e2e'],
        selenium: {
            start_process: false,
        },
        test_runner: 'mocha',
        test_settings: {
            default: {
                launch_url: options.url,
                selenium_port: seleniumPort,
                selenium_host: seleniumHost,
                silent: true,
                screenshots: {
                    enabled: !!screenshotsPath,
                    path: screenshotsPath,
                },
                desiredCapabilities: getBrowserConfig(options.browser, {
                    javascriptEnabled: true,
                    acceptSslCerts: true,
                    acceptInsecureCerts: true,
                }),
            },
        },
    });
}

/**
 * Command action to run tests.
 *
 * @param {CLI} app CLI instance.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options = {}) => {
    if (!paths.cwd) {
        // Unable to detect project root.
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    return getConfig(app, options)
        .then((config) => {
            const nw = new nightwatch.CliRunner({
                env: 'default',
            });
            nw.settings = config;
            nw.parseTestSettings();
            return new global.Promise((resolve) => {
                nw.runTests(resolve);
            });
        });
};
