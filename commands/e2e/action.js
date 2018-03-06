const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../lib/paths.js');
const which = require('npm-which')(paths.cli);
const browserslist = require('../../lib/browserslist.js');
const saucelabs = require('../../lib/saucelabs.js');
const exec = require('../../lib/exec.js');

const NIGHTWATCH_BIN = which.sync('nightwatch');

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
        test_workers: false,
        live_output: false,
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
            let promise = global.Promise.resolve();
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
                        config.test_settings.default.selenium_host = 'ondemand.saucelabs.com';
                        config.test_settings.default.selenium_port = 80;
                        config.test_settings.default.username = process.env.SAUCE_USERNAME;
                        config.test_settings.default.access_key = process.env.SAUCE_ACCESS_KEY;
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
                            on_failure: true,
                            on_error: false,
                        };
                        if (typeof options.screenshots === 'string') {
                            // override the path
                            config.test_settings.default.screenshots.path = options.screenshots;
                        } else {
                            // set a default path
                            config.test_settings.default.screenshots.path = config.test_settings.default.screenshots.path || 'reports/e2e/screenshots';
                        }
                    } else {
                        // option.screenshots is false
                        config.test_settings.default.screenshots = { enabled: false };
                    }
                }
            }
            let sauceConnectProcess;
            if (options.saucelabs) {
                // check sauce values
                if (options['saucelabs.username']) {
                    process.env.SAUCE_USERNAME = options['saucelabs.username'];
                    config.test_settings.default.username = process.env.SAUCE_USERNAME;
                }
                if (options['saucelabs.key']) {
                    process.env.SAUCE_ACCESS_KEY = options['saucelabs.key'];
                    config.test_settings.default.access_key = process.env.SAUCE_ACCESS_KEY;
                }
                if (!process.env.SAUCE_USERNAME) {
                    app.log(colors.red('Missing SAUCE_USERNAME variable.'));
                    app.log(colors.grey('export a `SAUCE_USERNAME` environment variable or use the `--saucelabs.username` flag.'));
                    return global.Promise.reject();
                }
                if (!process.env.SAUCE_ACCESS_KEY) {
                    app.log(colors.red('Missing SAUCE_ACCESS_KEY variable.'));
                    app.log(colors.grey('export a `SAUCE_ACCESS_KEY` environment variable or use the `--saucelabs.key` flag.'));
                    return global.Promise.reject();
                }
                promise = promise.then(() => new global.Promise((resolve, reject) => {
                    // setup sauce connect for localhost tunnel
                    const sauceConnectLauncher = require('sauce-connect-launcher');
                    let scTask = app.log('Setting up sauce connect...', true);
                    sauceConnectLauncher({
                        username: process.env.SAUCE_USERNAME,
                        accessKey: process.env.SAUCE_ACCESS_KEY,
                    }, (err, scProcess) => {
                        scTask();
                        if (err) {
                            return reject(err.message);
                        }
                        sauceConnectProcess = scProcess;
                        resolve();
                    });
                }));
                config.test_settings = config.test_settings || {};
                let browsers = saucelabs.selenium(options.targets ? browserslist.elaborate(options.targets) : browserslist.load(paths.cwd));
                for (let k in browsers) {
                    config.test_settings[k] = browsers[k];
                }
                options.browsers = Object.keys(browsers).join(',');
            }
            // Setup test name
            if (config.test_settings.default.launch_url) {
                for (let k in config.test_settings) {
                    config.test_settings[k].desiredCapabilities = config.test_settings[k].desiredCapabilities || {};
                    config.test_settings[k].desiredCapabilities['name'] = saucelabs.getTestName(paths.cwd, config.test_settings.default.launch_url, 'E2E');
                }
            }
            config.detailed_output = config.test_settings.default.detailed_output || !options.browsers || !options.browsers.includes(',');

            let configSource = path.join(paths.tmp, `nightwatch-config-${Date.now()}.json`);
            fs.writeFileSync(configSource, JSON.stringify(config));
            let failed = false;
            (options.browsers || 'default').split(',').forEach((env) => {
                promise = promise
                    .then(() => {
                        app.log(colors.cyan(`running ${env}`));
                        return exec(NIGHTWATCH_BIN, ['--config', configSource, '--env', env]);
                    })
                    .catch(() => {
                        failed = true;
                        return global.Promise.resolve();
                    });
            });
            return promise.then(() => {
                if (failed) {
                    return global.Promise.reject();
                }
                if (sauceConnectProcess) {
                    sauceConnectProcess.close();
                }
                return global.Promise.resolve();
            });
        });
};
