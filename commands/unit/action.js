const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const karma = require('karma');
const Mocha = require('mocha');
const paths = require('../../lib/paths.js');
const saucelabs = require('../../lib/saucelabs.js');
const Entry = require('../../lib/entry.js');
const browserslist = require('../../lib/browserslist.js');
const runNativeScriptTest = require('./lib/ns.js');

/**
 * A list of available environments.
 * @type {Object}
 */
const ENVIRONMENTS = {
    node: { runner: 'mocha' },
    browser: { runner: 'karma' },
    saucelabs: { runner: 'karma' },
    electron: { runner: 'karma' },
    nativescript: { runner: 'ns' },
};

/**
 * Get Karma configuration.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {string|Object}
 */
function getConfig(app, options) {
    let localConf = path.join(paths.cwd, 'karma.conf.js');
    if (fs.existsSync(localConf)) {
        // Local Karma config exists. Use that.
        return localConf;
    }
    let entry = Entry.resolve(paths.cwd, paths.cwd)[0];

    let conf = {
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: paths.cwd,

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha', 'chai'],

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: [
            options.ci ? 'dots' : 'mocha',
        ],

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: 'INFO',

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: !!options.server,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: [],

        // customContextFile if any
        customContextFile: options.customContextFile ? options.customContextFile : null,

        plugins: [
            require('karma-sourcemap-loader'),
            require('karma-mocha'),
            require('karma-mocha-reporter'),
            require('./plugins/karma-chai/index.js'),
        ],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: !options.server,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,
    };
    if (!options.server) {
        if (options.browser) {
            conf.frameworks.push('detectBrowsers');
            conf.plugins.push(
                require('karma-chrome-launcher'),
                require('karma-firefox-launcher'),
                require('karma-ie-launcher'),
                require('karma-edge-launcher'),
                require('karma-safari-launcher'),
                require('karma-opera-launcher'),
                require('karma-detect-browsers')
            );
            conf.customLaunchers = {
                Chrome_CI: {
                    base: 'Chrome',
                    flags: ['--no-sandbox'],
                },
            };
            conf.detectBrowsers = {
                usePhantomJS: false,
                postDetection: (availableBrowser) => {
                    // we are replacing the detected `Chrome` with the `Chrome_CI` configuration.
                    const ioChrome = availableBrowser.indexOf('Chrome');
                    if (ioChrome !== -1) {
                        availableBrowser.splice(ioChrome, 1, 'Chrome_CI');
                    }
                    return availableBrowser;
                },
            };
        }

        if (options.saucelabs) {
            // SauceLabs configuration.
            conf.retryLimit = 3;
            conf.concurrency = 2;
            conf.browserDisconnectTimeout = 10000;
            conf.browserDisconnectTolerance = 1;
            conf.browserNoActivityTimeout = 4 * 60 * 1000;
            conf.captureTimeout = 4 * 60 * 1000;
            conf.reporters.push('saucelabs');
            conf.sauceLabs = {
                startConnect: true,
                connectOptions: {
                    'no-ssl-bump-domains': 'all',
                    'username': process.env.SAUCE_USERNAME,
                    'accessKey': process.env.SAUCE_ACCESS_KEY,
                    'tunnelIdentifier': `RNA-${Date.now()}`,
                },
                options: {},
                username: process.env.SAUCE_USERNAME,
                accessKey: process.env.SAUCE_ACCESS_KEY,
                build: process.env.TRAVIS ? `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})` : undefined,
                tunnelIdentifier: process.env.TRAVIS ? process.env.TRAVIS_JOB_NUMBER : undefined,
                recordScreenshots: true,
            };
            if (entry && entry.package) {
                conf.sauceLabs.testName = saucelabs.getTestName(paths.cwd, entry.package.name, 'Unit');
            }
            let saucelabsBrowsers = saucelabs.launchers(options.targets ? browserslist.elaborate(options.targets) : browserslist.load(paths.cwd));
            conf.customLaunchers = saucelabsBrowsers;
            conf.browsers = Object.keys(saucelabsBrowsers);
            if (conf.browsers.length === 0) {
                throw new Error('invalid SauceLabs targets.');
            }
            conf.plugins.push(require('karma-sauce-launcher'));
        }

        if (options.electron) {
            // Test on Electron.
            conf.browsers = ['Electron'];
            conf.plugins.push(require('./plugins/karma-electron-launcher/index.js'));
        }
    }

    if (options.ci) {
        // Optimal configuration for CI environment.
        conf.client = conf.client || {};
        conf.client.captureConsole = false;
        conf.logLevel = 'ERROR';
    }

    if (options.coverage) {
        // Collect code coverage.
        conf.plugins.push('karma-coverage');
        conf.coverageReporter = {
            dir: 'reports/unit/coverage',
            reporters: [
                {
                    type: 'in-memory',
                },
                {
                    type: 'lcov',
                    subdir: (browserName) => path.join('report-lcov', browserName),
                },
            ],
        };
        conf.reporters.push('coverage');
    }

    return conf;
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

    // check sauce values
    if (options.saucelabs) {
        if (options['saucelabs.username']) {
            process.env.SAUCE_USERNAME = options['saucelabs.username'];
        }
        if (options['saucelabs.key']) {
            process.env.SAUCE_ACCESS_KEY = options['saucelabs.key'];
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
    }

    // Handle Karma custom context file option
    const customContextFile = options['context'];

    if (!process.env.hasOwnProperty('NODE_ENV')) {
        // Set NODE_ENV environment variable.
        app.log(colors.yellow('🔍 setting "test" environment.'));
        process.env.NODE_ENV = 'test';
    }

    // Load options.
    options = Proteins.clone(options);
    options.ci = options.hasOwnProperty('ci') ? options.ci : process.env.CI; // Is this CI environment?

    // Load list of files to be tested.
    let files = [];
    let entries = Entry.resolve(paths.cwd, options.arguments);
    entries.forEach((entry) => {
        if (entry.file) {
            // process file
            if (fs.statSync(entry.file.path).isDirectory()) {
                files.push(...Entry.resolve(paths.cwd, path.join(entry.file.path, 'test/unit/**/*.js')));
            } else {
                files.push(entry);
            }
        } else {
            // process package
            files.push(...Entry.resolve(paths.cwd, path.join(entry.package.path, 'test/unit/**/*.js')));
        }
    });
    if (!files.length) {
        app.log(colors.yellow('no unit tests found.'));
        return global.Promise.resolve();
    }

    let taskEnvironments = Object.keys(options).filter((optName) => options[optName] && optName in ENVIRONMENTS);
    if (!taskEnvironments.length) {
        // If test environment is not provide, use `browser` as default.
        taskEnvironments.push('browser');
    }

    // build tests
    let tempSource = path.join(paths.tmp, `source-${Date.now()}.js`);
    let tempUnit = path.join(paths.tmp, `unit-${Date.now()}.js`);
    const unitCode = `${files.map((entry) => `import '${entry.file.path}';`).join('\n')}`;
    fs.writeFileSync(tempSource, unitCode);
    return app.exec('build', { // Build sources.
        arguments: [tempSource],
        coverage: options.coverage,
        output: tempUnit,
        targets: options.targets,
        map: 'inline',
    }).then(() => { // Test built sources.
        let promise = global.Promise.resolve();
        taskEnvironments.forEach((taskEnvName) => {
            let taskEnv = ENVIRONMENTS[taskEnvName];
            if (taskEnv.runner === 'mocha') {
                // Startup Mocha.
                promise = promise.then(() => {
                    require('source-map-support/register');
                    const mocha = new Mocha();
                    mocha.addFile(tempUnit);
                    return new global.Promise((resolve, reject) => {
                        mocha.run((failures) => {
                            if (failures) {
                                reject(failures);
                            } else {
                                resolve();
                            }
                        });
                    });
                });
            } else if (taskEnv.runner === 'karma') {
                // Startup Karma.
                promise = promise.then(() => {
                    let karmaOptions;
                    try {
                        karmaOptions = getConfig(app, {
                            ci: options.ci,
                            server: options.server,
                            coverage: options.coverage,
                            targets: options.targets,
                            customContextFile,
                            [taskEnvName]: true,
                        });
                    } catch (err) {
                        return global.Promise.reject(err);
                    }
                    karmaOptions.files = [tempUnit];
                    karmaOptions.preprocessors = {
                        [tempUnit]: ['sourcemap'],
                    };
                    return new global.Promise((resolve, reject) => {
                        const server = new karma.Server(karmaOptions, (exitCode) => {
                            if (exitCode && !options.server) {
                                reject();
                            } else {
                                resolve();
                            }
                        });
                        if (!options.server) {
                            server.on('listening', (port) => {
                                const browsers = server.get('config').browsers;
                                if (!browsers || browsers.length === 0) {
                                    karma.stopper.stop({ port });
                                }
                            });
                        }
                        if (options.coverage) {
                            let reportMap;
                            server.on('run_start', () => {
                                reportMap = require('istanbul-lib-coverage').createCoverageMap({});
                            });
                            server.on('coverage_complete', (browser, coverageReport) => {
                                reportMap.merge(coverageReport);
                            });
                            server.on('run_complete', () => {
                                setTimeout(() => {
                                    reportMap = reportMap.toJSON();
                                    let coverageFiles = Object.keys(reportMap);
                                    if (coverageFiles.length) {
                                        const utils = require('istanbul/lib/object-utils');
                                        let summaries = coverageFiles.map((coverageFile) => utils.summarizeFileCoverage(reportMap[coverageFile]));
                                        let finalSummary = utils.mergeSummaryObjects.apply(null, summaries);
                                        app.log(colors.bold(colors.underline('COVERAGE SUMMARY:')));
                                        app.log(formatCoverageReport(finalSummary, 'statements'));
                                        app.log(formatCoverageReport(finalSummary, 'branches'));
                                        app.log(formatCoverageReport(finalSummary, 'functions'));
                                        app.log(formatCoverageReport(finalSummary, 'lines'));
                                    }
                                });
                            });
                        }
                        server.start();
                    });
                });
            } else if (taskEnv.runner === 'ns') {
                if (!['ios', 'android'].includes(options.nativescript.toLowerCase())) {
                    promise.then(() => global.Promise.reject('Invalid nativescript platform. Valid platforms are `ios` and `android`.'));
                } else {
                    // Create fake NS application.
                    promise = promise.then(() => runNativeScriptTest(options.nativescript, tempUnit));
                }
            }
        });

        return promise;
    });
};

/**
 * Format coverage report metrics.
 * @param {Object} summary The full file coverage report.
 * @param {String} key The metric name.
 * @return {String}
 */
function formatCoverageReport(summary, key) {
    let metrics = summary[key];
    let skipped;
    let result;
    // Capitalize the field name
    let field = key.substring(0, 1).toUpperCase() + key.substring(1);
    if (field.length < 12) {
        // add extra spaces after the field name
        field += '                   '.substring(0, 12 - field.length);
    }
    result = `${field} : ${metrics.pct}% (${metrics.covered}/${metrics.total})`;
    skipped = metrics.skipped;
    if (skipped > 0) {
        result += `, ${skipped} ignored`;
    }
    let color = (metrics.pct >= 80 && 'green') ||
        (metrics.pct >= 50 && 'yellow') ||
        'red';
    return colors[color](result);
}
