/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('unit')
        .description('Run project unit tests.')
        .option('[--targets]', 'A supported browserslist query.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browser]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use SauceLabs as browsers provider.')
        .option('[--saucelabs.username]', 'SauceLabs username.')
        .option('[--saucelabs.key]', 'SauceLabs access key.')
        .option('[--electron]', 'Use electron.')
        .option('[--nativescript <ios|android>]', 'Use nativescript.')
        .option('[--coverage]', 'Enable code coverage.')
        .option('[--ci]', 'Run in continuous integration mode.')
        .option('[--concurrency]', 'Concurrency level for Karma.')
        .option('[--context]', 'Use specified file as Karma custom context file for polyfill script.')
        .option('[--timeout]', 'Mocha timeout for a single test. Defaults to 2000 (ms).')
        .option('[--server]', 'Run test server.')
        .action(async (app, options = {}) => {
            const Proteins = require('@chialab/proteins');
            const karma = require('karma');
            const Mocha = require('mocha');
            const browserslist = require('browserslist');
            const Project = require('../../lib/Project');
            const Rollup = require('../../lib/Bundlers/Rollup');
            const runNativeScriptTest = require('./lib/ns');

            const cwd = process.cwd();
            const project = new Project(cwd);

            const targets = options.targets ? browserslist(options.targets) : project.browserslist;

            // check sauce values
            if (options.saucelabs) {
                if (options['saucelabs.username']) {
                    process.env.SAUCE_USERNAME = options['saucelabs.username'];
                }
                if (options['saucelabs.key']) {
                    process.env.SAUCE_ACCESS_KEY = options['saucelabs.key'];
                }
                if (!process.env.SAUCE_USERNAME) {
                    throw 'Missing SAUCE_USERNAME variable.';
                }
                if (!process.env.SAUCE_ACCESS_KEY) {
                    throw 'Missing SAUCE_ACCESS_KEY variable.';
                }
            }

            // Handle Karma custom context file option
            const customContextFile = options['context'];

            if (!process.env.hasOwnProperty('NODE_ENV')) {
                // Set NODE_ENV environment variable.
                app.logger.info('setting "test" environment');
                process.env.NODE_ENV = 'test';
            }

            // Load options.
            options = Proteins.clone(options);
            options.ci = options.hasOwnProperty('ci') ? options.ci : process.env.CI; // Is this CI environment?

            // Load list of files to be tested.
            let files = [];

            if (options.arguments.length) {
                files = project.resolve(options.arguments);
            } else {
                let testDir = project.directories.test;
                if (!testDir) {
                    project.directory('test');
                }
                if (!testDir.exists()) {
                    throw 'missing test files.';
                }
                files = testDir.resolve('**/*.js');
            }

            if (!files.length) {
                app.logger.warn('no unit tests found.');
                return;
            }

            let taskEnvironments = Object.keys(options).filter((optName) => options[optName] && optName in ENVIRONMENTS);
            if (!taskEnvironments.length) {
                // If test environment is not provide, use `browser` as default.
                taskEnvironments.push('browser');
            }

            const unitCode = `${files.map((entry) => `import '${entry.path}';`).join('\n')}`;

            // build tests
            const tempSource = app.store.tmpfile('unit-source.js');
            const tempUnit = app.store.tmpfile('unit-build.js');
            tempSource.write(unitCode);

            const config = Rollup.detectConfig(app, project, {
                'input': tempSource.path,
                'output': tempUnit.path,
                'map': 'inline',
                'coverage': options.coverage,
                targets,
                'jsx.pragma': options['jsx.pragma'],
                'jsx.module': options['jsx.module'],
            });
            const bundler = new Rollup(config);

            await bundler.build();

            // Test built sources.
            for (let i = 0; i < taskEnvironments.length; i++) {
                let taskEnvName = taskEnvironments[i];
                let taskEnv = ENVIRONMENTS[taskEnvName];
                if (taskEnv.runner === 'mocha') {
                    // Startup Mocha.
                    require('source-map-support/register');
                    const mocha = new Mocha();
                    mocha.addFile(tempUnit.path);
                    await new Promise((resolve, reject) => {
                        mocha.run((failures) => {
                            if (failures) {
                                reject(failures);
                            } else {
                                resolve();
                            }
                        });
                    });
                    continue;
                }

                if (taskEnv.runner === 'karma') {
                    // Startup Karma.
                    const karmaOptions = getConfig(app, project, {
                        ci: options.ci,
                        server: options.server,
                        coverage: options.coverage,
                        targets: options.targets,
                        concurrency: options.concurrency,
                        timeout: options.timeout,
                        customContextFile,
                        [taskEnvName]: true,
                    });
                    karmaOptions.files = [tempUnit.path];
                    karmaOptions.preprocessors = {
                        [tempUnit.path]: ['sourcemap'],
                    };
                    const server = await new Promise((resolve, reject) => {
                        let s = new karma.Server(karmaOptions, (exitCode) => {
                            if (exitCode && !options.server) {
                                reject();
                            } else {
                                resolve(s);
                            }
                        });
                    });
                    if (!options.server) {
                        server.on('listening', (port) => {
                            let browsers = server.get('config').browsers;
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
                                    app.logger.info('COVERAGE SUMMARY:');
                                    let statementsReport = formatCoverageReport(finalSummary, 'statements');
                                    app.logger[statementsReport.type](statementsReport.message);
                                    let branchesReport = formatCoverageReport(finalSummary, 'branches');
                                    app.logger[branchesReport.type](branchesReport.message);
                                    let functionsReport = formatCoverageReport(finalSummary, 'functions');
                                    app.logger[functionsReport.type](functionsReport.message);
                                    let linesReport = formatCoverageReport(finalSummary, 'lines');
                                    app.logger[linesReport.type](linesReport.message);
                                }
                            });
                        });
                    }
                    server.start();
                    continue;
                }

                if (taskEnv.runner === 'ns') {
                    if (!['ios', 'android'].includes(options.nativescript.toLowerCase())) {
                        throw 'Invalid nativescript platform. Valid platforms are `ios` and `android`.';
                    }
                    // Create fake NS application.
                    await runNativeScriptTest(app, options.nativescript, tempUnit.path);
                }
            }
        });
};


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
 * @param {Project} project The current project.
 * @param {Object} options Options.
 * @returns {string|Object}
 */
function getConfig(app, project, options) {
    const saucelabs = require('../../lib/saucelabs');

    const localConf = project.file('karma.conf.js');
    if (localConf.exists()) {
        // Local Karma config exists. Use that.
        return localConf;
    }

    const conf = {
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: project.path,

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha', 'chai'],

        // mocha timeout option if given
        client: {
            mocha: {
                timeout: typeof options.timeout === 'number' ? options.timeout : 2000,
            },
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: [
            options.ci ? 'dots' : 'mocha',
        ],

        // web server port
        port: 9876,

        // browser's timeout for handling Safari issues
        browserDisconnectTimeout: 6 * 1000,
        browserDisconnectTolerance: 5,
        browserNoActivityTimeout: 2 * 60 * 1000,
        captureTimeout: 2 * 60 * 1000,

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
        // how many browser should be started simultaneously
        concurrency: typeof options.concurrency === 'number' ? options.concurrency : 2,
    };

    if (!options.server) {
        if (options.browser) {
            conf.frameworks.push('detectBrowsers');
            // list of browsers with launcher.
            const launchers = ['chrome', 'firefox', 'ie', 'edge', 'safari', 'opera'];
            launchers.forEach((launcherName) => {
                // add the launcher plugin for each browser.
                conf.plugins.push(
                    require(`karma-${launcherName}-launcher`)
                );
            });
            conf.plugins.push(
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
                    // remove available browsers without a launcher.
                    availableBrowser = availableBrowser.filter((browserName) => launchers.indexOf(browserName.toLowerCase()) !== -1);
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
            conf.reporters.push('saucelabs');
            conf.sauceLabs = {
                startConnect: true,
                connectOptions: {
                    'no-ssl-bump-domains': 'all',
                },
                options: {},
                username: process.env.SAUCE_USERNAME,
                accessKey: process.env.SAUCE_ACCESS_KEY,
                build: process.env.TRAVIS ? `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})` : `RNA-${Date.now()}`,
                tunnelIdentifier: process.env.TRAVIS ? process.env.TRAVIS_JOB_NUMBER : undefined,
                recordScreenshots: true,
            };

            conf.sauceLabs.testName = saucelabs.getTestName(project.path, project.get('name'), 'Unit');

            let saucelabsBrowsers = saucelabs.launchers(project.browserslist);
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
            conf.customLaunchers = {
                Electron: {
                    base: 'Electron',
                    tmpdir: app.store.tmpdir('ElectronTest').path,
                },
            };
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
            dir: project.directory('reports/coverage').path,
            reporters: [
                {
                    type: 'in-memory',
                },
                {
                    type: 'lcov',
                    subdir: (browserName) => `report-lcov/${browserName}`,
                },
            ],
        };
        conf.reporters.push('coverage');
    }

    return conf;
}

/**
 * Format coverage report metrics.
 * @param {Object} summary The full file coverage report.
 * @param {String} key The metric name.
 * @return {String}
 */
function formatCoverageReport(summary, key) {
    let metrics = summary[key];
    let skipped;
    let message;
    // Capitalize the field name
    let field = key.substring(0, 1).toUpperCase() + key.substring(1);
    if (field.length < 12) {
        // add extra spaces after the field name
        field += '                   '.substring(0, 12 - field.length);
    }
    message = `${field} : ${metrics.pct}% (${metrics.covered}/${metrics.total})`;
    skipped = metrics.skipped;
    if (skipped > 0) {
        message += `, ${skipped} ignored`;
    }
    let type = (metrics.pct >= 80 && 'success') ||
        (metrics.pct >= 50 && 'warn') ||
        'error';
    return {
        type,
        message,
    };
}
