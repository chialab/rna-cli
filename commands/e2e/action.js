const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const nightwatch = require('nightwatch');
const paths = require('../../lib/paths.js');
const browserslist = require('../../lib/browserslist.js');
const saucelabs = require('../../lib/saucelabs.js');

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
                desiredCapabilities: {
                    javascriptEnabled: true,
                    acceptSslCerts: true,
                    acceptInsecureCerts: true,
                },
            },
            chrome: {
                desiredCapabilities: {
                    browserName: 'chrome',
                    chromeOptions: {
                        args: ['--no-sandbox', '--disable-web-security'],
                        prefs: {
                            'intl.accept_languages': 'en',
                        },
                    },
                },
            },
            firefox: {
                desiredCapabilities: {
                    browserName: 'firefox',
                    firefoxOptions: {
                        prefs: {
                            'intl.accept_languages': 'en',
                        },
                    },
                },
            },
            edge: {
                desiredCapabilities: {
                    browserName: 'MicrosoftEdge',
                },
            },
            ie: {
                desiredCapabilities: {
                    browserName: 'internet explorer',
                },
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
                if (options['selenium.host'] || options.saucelabs || !config.test_settings.default.selenium_host) {
                    if (options.saucelabs) {
                        config.test_settings.default.selenium_host = options.saucelabs;
                        config.test_settings.default.selenium_port = 80;
                    } else {
                        config.test_settings.default.selenium_host = options['selenium.host'] || 'localhost';
                    }
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
            config.output = config.output || typeof config.output == 'undefined';
            config.detailed_output = config.detailed_output || typeof config.detailed_output == 'undefined';

            if (options.saucelabs) {
                config.test_settings = config.test_settings || {};
                let browsers = saucelabs.selenium(options.targets ? browserslist.elaborate(options.targets) : browserslist.load(paths.cwd));
                for (let k in browsers) {
                    config.test_settings[k] = browsers[k];
                }
                options.browsers = Object.keys(browsers).join(',');
            }

            const nw = new nightwatch.CliRunner({
                env: options.browsers || 'default',
            });
            nw.settings = config;
            nw.parseTestSettings();
            return new global.Promise((resolve) => {
                nw.runTests(resolve);
            });
        });
};
