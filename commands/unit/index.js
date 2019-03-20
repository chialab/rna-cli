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
        .readme(`${__dirname}/README.md`)
        .option('[--targets]', 'A supported browserslist query.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browser]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use SauceLabs as browsers provider.')
        .option('[--electron]', 'Run tests in Electron context.')
        .option('[--nativescript <ios|android>]', 'Run tests in Nativescript context.')
        .option('[--coverage]', 'Generate a code coverage report.')
        .option('[--concurrency]', 'Set concurrency level for tests.')
        .option('[--context]', 'Use a specific HTML document for tests.')
        .option('[--timeout]', 'Set the tests timeout.')
        .option('[--watch]', 'Watch test files.')
        .action(async (app, options = {}) => {
            const browserslist = require('browserslist');
            const Project = require('../../lib/Project');
            const ScriptBundler = require('../../lib/Bundlers/ScriptBundler');
            const Watcher = require('../../lib/Watcher');

            const cwd = process.cwd();
            const project = new Project(cwd);

            // check sauce values
            if (options.saucelabs) {
                if (options['saucelabs.username']) {
                    process.env.SAUCE_USERNAME = options['saucelabs.username'];
                }
                if (options['saucelabs.key']) {
                    process.env.SAUCE_ACCESS_KEY = options['saucelabs.key'];
                }
                if (!process.env.SAUCE_USERNAME && app.store.get('saucelabs.username')) {
                    process.env.SAUCE_USERNAME = app.store.get('saucelabs.username');
                }
                if (!process.env.SAUCE_ACCESS_KEY && app.store.get('saucelabs.accessKey')) {
                    process.env.SAUCE_ACCESS_KEY = app.store.get('saucelabs.accessKey');
                }
                if (!process.env.SAUCE_USERNAME) {
                    throw 'Missing SAUCE_USERNAME variable.';
                }
                if (!process.env.SAUCE_ACCESS_KEY) {
                    throw 'Missing SAUCE_ACCESS_KEY variable.';
                }
            }

            if (!process.env.hasOwnProperty('NODE_ENV')) {
                // Set NODE_ENV environment variable.
                app.logger.info('setting "test" environment');
                process.env.NODE_ENV = 'test';
            }

            // Load options.
            options = Object.assign({}, options, {
                targets: browserslist(options.targets || project.browserslist),
            });

            // Load list of files to be tested.
            let files = [];

            if (options.arguments.length) {
                files = project.resolve(options.arguments)
                    .reduce((list, file) => {
                        if (!(file instanceof Project)) {
                            list.push(file);
                            return list;
                        }
                        let testDir = file.directories.test;
                        if (!testDir) {
                            testDir = file.directory('test');
                        }
                        if (testDir.exists()) {
                            list.push(...testDir.resolve('**/*.js'));
                        }
                        return list;
                    }, []);
            } else {
                let testDirs = [];
                let workspaces = project.workspaces;
                if (workspaces) {
                    workspaces.forEach((entry) => {
                        let testDir = entry.directories.test;
                        if (!testDir) {
                            testDir = entry.directory('test');
                        }
                        testDirs.push(testDir);
                    });
                } else {
                    let testDir = project.directories.test;
                    if (!testDir) {
                        testDir = project.directory('test');
                    }
                    testDirs.push(testDir);
                }
                files = testDirs
                    .reduce((list, directory) => {
                        if (directory.exists()) {
                            list.push(...directory.resolve('**/*.js'));
                        }
                        return list;
                    }, []);
            }

            if (!files.length) {
                app.logger.warn('no unit tests found.');
                return;
            }

            let taskEnvironments = Object.keys(options).filter((optName) => options[optName] && optName in ENVIRONMENTS);
            if (!taskEnvironments.length) {
                // If test environment is not provide, use `browser` as default.
                taskEnvironments.push('node', 'browser');
                options.node = true;
                options.browser = true;
            }

            const unitCode = `${files.map((entry) => `import '${entry.path}';`).join('\n')}`;

            // build tests
            const tempSource = app.store.tmpfile('unit-source.js');
            const tempUnit = app.store.tmpfile('unit-build.js');
            tempSource.write(unitCode);

            let rebuild;
            let watchFiles;
            try {
                let bunlder = new ScriptBundler(app, project);
                await bunlder.setup({
                    'input': tempSource,
                    'output': tempUnit,
                    'map': 'inline',
                    'coverage': options.coverage,
                    'targets': options.targets,
                    'jsx.pragma': options['jsx.pragma'],
                    'jsx.module': options['jsx.module'],
                });

                rebuild = async function() {
                    app.logger.play('building test...', tempSource.localPath);
                    await bunlder.build();
                    watchFiles = bunlder.files;
                    app.logger.stop();
                };

                await rebuild();
            } catch (error) {
                app.logger.stop();
                throw error;
            }

            app.logger.stop();

            try {
                await runTests(app, project, tempUnit, options, taskEnvironments);
            } catch (error) {
                if (!options.watch) {
                    throw error;
                }
            }

            if (options.watch) {
                // start the watch task
                const watcher = new Watcher(project, {
                    ignore: (file) => !watchFiles.includes(file) || (file === tempUnit.path),
                });

                await watcher.watch(async () => {
                    app.logger.newline();
                    await rebuild();
                    await runTests(app, project, tempUnit, options, taskEnvironments);
                });
            }
        });
};

/**
 * @typedef {Object} TestResult
 * @property {Number} exitCode The exit code of the test.
 * @property {Number} failed Failed tests count.
 * @property {Object} coverage The coverage map result.
 */


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
 * Exec tests across multiple environments.
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The active project.
 * @param {NavigatorFile} testFile The source test file.
 * @param {Object} options A set of options for tests.
 * @param {Array<string>} environments A list of test environments.
 * @return {Promise}
 */
async function runTests(app, project, testFile, options, environments = []) {
    const coverageMap = require('istanbul-lib-coverage').createCoverageMap({});

    let finalExitCode = 0;
    // Test built sources.
    for (let i = 0; i < environments.length; i++) {
        let taskEnvName = environments[i];
        let taskEnv = ENVIRONMENTS[taskEnvName];

        if (taskEnv.runner === 'mocha') {
            // Startup Mocha.
            let { exitCode, coverage } = await runNodeTests(app, project, testFile, options);
            if (coverage) {
                coverageMap.merge(coverage);
            }
            if (exitCode !== 0) {
                finalExitCode = exitCode;
            }
            continue;
        }

        if (taskEnv.runner === 'karma') {
            // Startup Karma.
            let { exitCode, coverage } = await runBrowserTests(app, project, testFile, options);
            if (coverage) {
                coverageMap.merge(coverage);
            }
            if (exitCode !== 0) {
                finalExitCode = exitCode;
            }
            continue;
        }

        if (taskEnv.runner === 'ns') {
            if (!['ios', 'android'].includes(options.nativescript.toLowerCase())) {
                throw 'Invalid nativescript platform. Valid platforms are `ios` and `android`.';
            }
            // Create fake NS application.
            let { exitCode, coverage } = await runNativeScriptTest(app, testFile, options.nativescript);
            if (coverage) {
                coverageMap.merge(coverage);
            }
            if (exitCode !== 0) {
                finalExitCode = exitCode;
            }
        }
    }

    app.logger.newline();

    if (options.coverage) {
        printCoverageReport(app, coverageMap.toJSON());
    }

    if (finalExitCode) {
        throw 'some tests have failed';
    }

    return coverageMap;
}

/**
 * Exec tests in a Node environment using Node Mocha API.
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The active project.
 * @param {NavigatorFile} testFile The source test file.
 * @param {Object} options A set of options for tests.
 * @return {Promise<TestResult>}
 */
async function runNodeTests(app, project, testFile, options = {}) {
    const Mocha = require('mocha');
    require('source-map-support/register');
    const mocha = new Mocha();

    mocha.addFile(testFile.path);
    return await new Promise((resolve) => {
        mocha.run((failures) => {
            let coverage;
            if (options.coverage) {
                const { Collector, Reporter, config } = require('istanbul');
                const collector = new Collector();
                const reporter = new Reporter(config.loadObject({
                    reporting: {
                        print: 'summary',
                        reports: [ 'lcov' ],
                        dir: project.directory(`reports/coverage/${process.title}-${process.version}`).path,
                    },
                }));
                coverage = global.__coverage__;
                collector.add(coverage);
                delete global.__coverage__;
                reporter.addAll(['lcov']);
                reporter.write(collector, true, () => {});
            }
            resolve({
                exitCode: failures ? 1 : 0,
                coverage,
                failed: failures.length,
            });
        });
    });
}

/**
 * Exec tests in a Browser environment using Karma test runner.
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The active project.
 * @param {NavigatorFile} testFile The source test file.
 * @param {Object} options A set of options for tests.
 * @return {Promise<TestResult>}
 */
async function runBrowserTests(app, project, testFile, options = {}) {
    const karma = require('karma');
    const coverageMap = require('istanbul-lib-coverage').createCoverageMap({});

    // Handle Karma custom context file option
    let customContextFile;
    if (options['context']) {
        let original = project.file(options['context']);
        customContextFile = testFile.parent.file(original.basename);
        customContextFile.write(original.read());
    }

    const karmaOptions = await getKarmaConfig(app, project, {
        basePath: testFile.dirname,
        watch: options.watch,
        coverage: options.coverage,
        targets: options.targets,
        concurrency: options.concurrency || (options.watch ? Infinity : undefined),
        timeout: options.timeout,
        customContextFile: customContextFile ? customContextFile.basename : undefined,
        saucelabs: !!options.saucelabs,
        electron: !!options.electron,
        browser: !!options.browser,
    });
    karmaOptions.middleware = karmaOptions.middleware || [];
    karmaOptions.middleware.push('base');
    karmaOptions.plugins = karmaOptions.plugins || [];
    karmaOptions.plugins.push({
        'middleware:base': ['factory', function base() {
            return function(request, response, next) {
                if (request.url.startsWith('/base/')) {
                    return next();
                }
                response.writeHead(302, {
                    Location: `/base${request.url}`,
                });
                response.end();
            };
        }],
    });
    karmaOptions.files = [
        {
            pattern: testFile.basename,
            included: true,
            served: true,
            nocache: true,
            watched: false,
        },
        {
            pattern: '**/*',
            included: false,
            served: true,
            nocache: false,
            watched: false,
        },
    ];
    karmaOptions.preprocessors = karmaOptions.preprocessors || {};
    karmaOptions.preprocessors[testFile.path] = ['sourcemap'];

    return await new Promise((resolve) => {
        let failed = 0;
        const server = new karma.Server(karmaOptions, (exitCode) => {
            resolve({
                exitCode,
                failed,
                coverage: coverageMap.toJSON(),
            });
        });

        server.on('coverage_complete', (browser, coverageReport) => {
            coverageMap.merge(coverageReport);
        });

        server.on('run_complete', (browser, result) => {
            failed = result.failed;
        });

        server.start();
    });
}

/**
 * Exec tests in a NativeScript environment using tns cli.
 * @param {CLI} app The current CLI instance.
 * @param {NavigatorFile} testFile The source test file.
 * @param {String} platform Android or iOS.
 * @return {Promise<TestResult>}
 */
async function runNativeScriptTest(app, file, platform) {
    const exec = require('../../lib/exec.js');

    let dir = app.store.tmpdir('NSTest');
    let appDir = dir.directory('Test');
    await exec('tns', ['create', 'Test', '--path', dir.path, '--js']);
    await exec('tns', ['test', 'init', '--path', appDir.path, '--framework', 'mocha']);
    let testDir = appDir.directory('app').directory('tests');
    testDir.empty();
    testDir.file('test.js').write(file.read());
    let exitCode = 0;
    try {
        await exec('tns', ['test', platform, '--emulator', '--justlaunch', '--path', appDir.path]);
    } catch (error) {
        exitCode = 1;
    }
    return {
        exitCode,
        failed: null,
        coverage: null,
    };
}

/**
 * Get Karma configuration.
 *
 * @param {CLI} app CLI.
 * @param {Project} project The current project.
 * @param {Object} options Options.
 * @returns {Promise<string|Object>}
 */
async function getKarmaConfig(app, project, options) {
    const localConf = project.file('karma.conf.js');
    if (localConf.exists()) {
        // Local Karma config exists. Use that.
        return localConf;
    }

    const conf = {
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: options.basePath || project.path,

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha', 'chai'],

        // mocha timeout option if given
        client: {
            mocha: {
                timeout: !isNaN(options.timeout) ? options.timeout : 2000,
            },
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['mocha'],

        // web server port
        port: 9876,

        // browser's timeout for handling Safari issues
        browserDisconnectTimeout: 6 * 1000,
        browserDisconnectTolerance: 0,
        browserNoActivityTimeout: 2 * 60 * 1000,
        captureTimeout: 5 * 60 * 1000,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: 'INFO',

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: [],

        // customContextFile if any
        customContextFile: options.customContextFile ? options.customContextFile : null,

        plugins: [
            require('karma-sourcemap-loader'),
            require('karma-mocha'),
            require('./plugins/karma-mocha-reporter/index.js'),
            require('./plugins/karma-chai/index.js'),
        ],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: !options.watch,

        // Concurrency level
        // how many browser should be started simultaneously
        concurrency: !isNaN(options.concurrency) ? options.concurrency : 2,
    };

    if (options.browser) {
        const launchers = ['chrome', 'firefox', 'ie', 'edge', 'opera', 'safari'];

        conf.frameworks.push('detectBrowsers');
        conf.plugins.push(
            require('karma-chrome-launcher'),
            require('karma-firefox-launcher'),
            require('karma-ie-launcher'),
            require('karma-edge-launcher'),
            require('karma-opera-launcher'),
            require('./plugins/karma-safari-launcher/karma-safari-launcher'),
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
        const saucelabs = require('../../lib/saucelabs');

        let job = (process.env.TRAVIS && `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})`) ||
            (process.env.GITLAB_CI && `GITLAB # ${process.env.CI_JOB_NAME} (${process.env.CI_JOB_ID})`) ||
            `RNA # ${Date.now()}`;

        // SauceLabs configuration.
        conf.retryLimit = 0;
        conf.reporters.push('saucelabs');
        conf.sauceLabs = {
            startConnect: true,
            connectOptions: {
                'no-ssl-bump-domains': 'all',
            },
            idleTimeout: 3 * 60 * 1000,
            username: process.env.SAUCE_USERNAME,
            accessKey: process.env.SAUCE_ACCESS_KEY,
            build: job,
            recordScreenshots: true,
            testName: getTestName(project),
        };

        let saucelabsBrowsers = await saucelabs.launchers(options.targets);
        conf.customLaunchers = saucelabsBrowsers;
        conf.browsers = Object.keys(saucelabsBrowsers);
        if (conf.browsers.length === 0) {
            throw new Error('invalid SauceLabs targets.');
        }
        conf.plugins.push(require('./plugins/karma-sauce-launcher/index.js'));
    }

    if (options.electron) {
        // Test on Electron.
        conf.browsers = ['ElectronBrowser'];
        conf.customLaunchers = {
            ElectronBrowser: {
                base: 'Electron',
                tmpdir: app.store.tmpdir('ElectronTest').path,
            },
        };
        conf.plugins.push(require('./plugins/karma-electron-launcher/index.js'));
    }

    if (process.env.CI) {
        // Optimal configuration for CI environment.
        conf.client = conf.client || {};
        conf.client.captureConsole = false;
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
                    subdir: (browserName) => browserName,
                },
            ],
        };
        conf.reporters.push('coverage');
    }

    return conf;
}

/**
 * Printe the coverage report in console.
 * @param {CLI} app The cli instance.
 * @param {Object} report The report to print.
 * @return {void}
 */
function printCoverageReport(app, report) {
    const utils = require('istanbul/lib/object-utils');
    const coverageFiles = Object.keys(report);
    if (!coverageFiles.length) {
        return;
    }
    let summaries = coverageFiles.map((coverageFile) => utils.summarizeFileCoverage(report[coverageFile]));
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

/**
 * Create a Test name using git status.
 * @param {Project} project The project to test.
 * @return {String}
 */
function getTestName(project) {
    const Git = require('../../lib/Git.js');

    let message = `Tests for ${project.get('name')}`;
    const gitClient = new Git(project.path);

    const branchName = gitClient.getBranchName();
    const commit = gitClient.getShortCommitCode();
    const commitMessage = gitClient.getCommitMessage();

    if (branchName) {
        message = `${message} | ${branchName.trim()}`;
    }

    if (commit) {
        message = `${message}, ${commit.trim()}`;
    }

    if (commitMessage) {
        message = `${message}: '${commitMessage.trim().replace(/^['"]*/, '').replace(/['"]*$/, '')}'`;
    }

    return message;
}
