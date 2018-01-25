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
    return global.Promise.resolve({
        selenium: {
            start_process: false,
        },
        test_runner: 'mocha',
        test_settings: {
            default: {
                launch_url: options.url,
                silent: true,
                desiredCapabilities: getBrowserConfig(options.browser || 'chrome', {
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
            // test path defaults
            if (options.arguments.length || !config.src_folders) {
                config.src_folders = options.arguments.length ? options.arguments : ['test/e2e'];
            }
            if (config.test_settings && config.test_settings.default) {
                if (options.url) {
                    config.test_settings.default.launch_url = options.url;
                }
                // selenium conf defaults
                if (options['selenium.host'] || !config.test_settings.default.selenium_host) {
                    config.test_settings.default.selenium_host = options['selenium.host'] || 'localhost';
                }
                if (options['selenium.port'] || !config.test_settings.default.selenium_port) {
                    config.test_settings.default.selenium_port = options['selenium.port'] || 4444;
                }
                // screenshots conf defaults
                if (options.hasOwnProperty('screenshots') || !config.test_settings.default.screenshots) {
                    // option.screenshots detected
                    if (options.screenshots) {
                        // option.screenshots is true or a path
                        config.test_settings.default.screenshots = {
                            enabled: true,
                        };
                        if (typeof options.screenshots === 'string') {
                            // override the path
                            config.test_settings.default.screenshots.path = options.screenshots;
                        } else {
                            // set a default path
                            config.test_settings.default.screenshots.path = config.test_settings.default.screenshots.path || 'test/screenshots/e2e';
                        }
                    } else {
                        // option.screenshots is false
                        config.test_settings.default.screenshots = { enabled: false };
                    }
                }
            }
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
