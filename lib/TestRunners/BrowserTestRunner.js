const karma = require('karma');
const resolve = require('resolve');
const { clone } = require('@chialab/proteins');
const ScriptBundler = require('../Bundlers/ScriptBundler');
const TestRunner = require('./TestRunner');
const Targets = require('../Targets');
const { File, filterExisting } = require('../File');
const { Reporter } = require('./Reporter');
const { detect } = require('./lib/detect-browsers');

/**
 * Create a Test name using git status.
 * @param {Project} project The project to test.
 * @return {string}
 */
function getTestName(project) {
    if (!project) {
        return '';
    }

    let message = `Tests for ${project.get('name')}`;

    if (!project.git.check()) {
        return message;
    }

    let branchName = project.git.getBranchName();
    let commit = project.git.getShortCommitCode();
    let commitMessage = project.git.getCommitMessage();

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

async function generatePolyfillCode() {
    let promisePolyfillUrl = resolve.sync('promise-polyfill/dist/polyfill.min', {
        basedir: __dirname,
    });

    return new File(promisePolyfillUrl).read();
}

async function generateSystemCode() {
    let systemUrl = resolve.sync('systemjs/dist/s.min', {
        basedir: __dirname,
    });
    let content = await new File(systemUrl).read();

    return content.replace(/\b(let|const)\b/g, 'var');
}

async function generateKarmaCode(file) {
    let [promisePolyfillCode, systemCode] = await Promise.all([
        generatePolyfillCode(),
        generateSystemCode(),
    ]);

    return `var karmaLoad = window.__karma__.loaded.bind(window.__karma__);
var karmaStart = window.__karma__.start.bind(window.__karma__);
window.__karma__.loaded = function() {};
window.__karma__.start = function() {};
${promisePolyfillCode}${systemCode}System.import('./base/${file}').then(function() { karmaStart(); })`;
}

class BrowserTestRunner extends TestRunner {
    get name() {
        return 'Browser';
    }

    async setup(options = {}) {
        await super.setup(options);

        let targets = Targets.parse(options.targets);
        let config = {
            // base path that will be used to resolve all patterns (eg. files, exclude)
            basePath: options.root.path,

            // options object to be used by Node's https class
            httpsServerOptions: options.https,

            // Enable or disable failure on failing tests.
            failOnFailingTestSuite: false,

            //  Enable or disable failure on tests deliberately disabled, eg fit() or xit() tests in jasmine. Use this to prevent accidental disabling tests needed to validate production.
            failOnSkippedTests: false,

            // Enable or disable failure on running empty test-suites. If disabled the program will return exit-code 0 and display a warning.
            failOnEmptyTestSuite: false,

            // frameworks to use
            // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
            frameworks: ['source-map-support', 'mocha', 'chai'],

            mochaReporter: {
                showDiff: true,
            },

            // mocha timeout option if given
            client: {
                captureConsole: false,
                mocha: {
                    timeout: !isNaN(options.timeout) ? options.timeout : 2000,
                },
            },

            // test results reporter to use
            // possible values: 'dots', 'progress'
            // available reporters: https://npmjs.org/browse/keyword/karma-reporter
            reporters: ['null'],

            // web server port
            port: 9876,

            // browser's timeout for handling Safari issues
            browserDisconnectTimeout: 2 * 6 * 1000,
            // https://github.com/karma-runner/karma/issues/3077
            browserDisconnectTolerance: 0,
            browserNoActivityTimeout: 2 * 60 * 1000,
            captureTimeout: 5 * 60 * 1000,

            // enable / disable colors in the output (reporters and logs)
            colors: true,

            // level of logging
            // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
            logLevel: 'off',

            // enable / disable watching file and executing tests whenever any file changes
            autoWatch: false,

            // start these browsers
            // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
            browsers: [],

            // context if any
            customContextFile: options.context && options.context.path,

            plugins: [
                require('karma-source-map-support'),
                require('karma-mocha'),
                require('./plugins/karma-chai/index.js'),
                require('./plugins/karma-null-reporter/index.js'),
            ],

            // Continuous Integration mode
            // if true, Karma captures browsers, runs the tests and exits
            singleRun: true,

            // Run the tests inside an iFrame or a new window
            // If true, Karma runs the tests inside an iFrame. If false, Karma runs the tests in a new window. Some tests may not run in an iFrame and may need a new window to run
            useIframe: false,

            // Concurrency level
            // how many browser should be started simultaneously
            concurrency: !isNaN(options.concurrency) ? options.concurrency : 2,

            files: [
                {
                    pattern: '**/*',
                    included: false,
                    served: true,
                    nocache: false,
                    watched: false,
                },
            ],
        };

        if (options.browser) {
            let browsers = {
                chrome: 'Chrome_CI',
                firefox: 'Firefox_CI',
                ie: 'IE',
                edge: 'Edge',
                edgelegacy: 'EdgeLegacy',
                opera: 'Opera',
                safari: 'Safari',
                ios: 'iOS',
                android: 'Android',
            };

            config.plugins.push(
                require('karma-chrome-launcher'),
                require('karma-firefox-launcher'),
                require('karma-ie-launcher'),
                require('./plugins/karma-edge-chromium-launcher/karma-edge-chromium-launcher'),
                require('./plugins/karma-safari-launcher/karma-safari-launcher'),
                require('karma-opera-launcher'),
                require('./plugins/karma-ios-launcher/karma-ios-launcher'),
                require('./plugins/karma-android-launcher/karma-android-launcher'),
            );
            config.customLaunchers = Object.assign({}, config.customLaunchers || {}, {
                Chrome_CI: {
                    base: options.headless ? 'ChromeHeadless' : 'Chrome',
                    flags: ['--no-sandbox'],
                },
                Firefox_CI: {
                    base: options.headless ? 'FirefoxHeadless' : 'Firefox',
                    prefs: {
                        'app.update.enabled': false,
                        'browser.search.update': false,
                        'extensions.update.enabled': false,
                        'datareporting.policy.firstRunURL': '',
                        'media.ffmpeg.enabled': true,
                        'network.proxy.type': 0,
                    },
                    extensions: [],
                },
                Edge_CI: {
                    base: options.headless ? 'EdgeHeadless' : 'Edge',
                    flags: ['--no-sandbox'],
                },
            });

            let requested = typeof options.browser === 'string' ?
                options.browser.split(/[\s-_,]{1,}/) :
                ['chrome', 'firefox'];

            let available = detect()
                .filter((browserName) => browserName.toLowerCase() in browsers)
                .filter((browserName) => requested.indexOf(browserName.toLowerCase()) !== -1);

            config.browsers = available
                .map((browserName) => browsers[browserName.toLowerCase()]);
        }

        if (options.saucelabs) {
            let job = (process.env.TRAVIS && `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})`) ||
                (process.env.GITLAB_CI && `GITLAB # ${process.env.CI_JOB_NAME} (${process.env.CI_JOB_ID})`) ||
                `RNA # ${Date.now()}`;

            // SauceLabs configuration.
            config.retryLimit = 0;
            config.sauceLabs = {
                startConnect: true,
                connectOptions: {
                    'no-ssl-bump-domains': 'all',
                },
                idleTimeout: 3 * 60 * 1000,
                username: process.env.SAUCE_USERNAME,
                accessKey: process.env.SAUCE_ACCESS_KEY,
                build: job,
                recordScreenshots: true,
                testName: getTestName(this.options.project),
            };

            let saucelabsBrowsers = await targets.toSauceLabs();
            config.customLaunchers = Object.assign({}, config.customLaunchers || {}, saucelabsBrowsers);
            config.browsers = Object.keys(saucelabsBrowsers);
            if (config.browsers.length === 0) {
                throw new Error('invalid SauceLabs targets.');
            }
            config.plugins.push(require('./plugins/karma-sauce-launcher/index.js'));
        }

        if (process.env.CI) {
            // Optimal configuration for CI environment.
            config.client = config.client || {};
            config.client.captureConsole = false;
        }

        this.config = config;
        this.compilerCache = {};
    }

    async build(files) {
        this.emit(BrowserTestRunner.PREPARE_START_EVENT);

        await super.build(files);

        let inputCode = files
            .filter((file) => file.path.indexOf(this.testDir.path) !== 0)
            .filter((file) => file.path.indexOf(this.coverageDir.path) !== 0)
            .map((file) => `import '${file.path}';`).join('\n');
        let testFile = this.testDir.file('__specs__.js');
        let karmaCode = await generateKarmaCode(this.options.root.relative(testFile));
        await this.entryPoint.write(karmaCode);

        let bundler = new ScriptBundler();
        bundler.on(ScriptBundler.BUILD_PROGRESS_EVENT, (file) => {
            this.emit(BrowserTestRunner.PREPARE_PROGRESS_EVENT, file);
        });
        await bundler.setup({
            code: inputCode,
            input: testFile,
            root: this.options.root,
            output: this.testDir,
            format: 'system',
            targets: this.options.targets,
            bundle: true,
            map: 'inline',
            lint: false,
            analyze: false,
            typings: false,
            progress: false,
            coverage: this.options.coverage,
            jsx: this.options.jsx,
        });

        let { watchFiles } = await bundler.build();
        let resources = await filterExisting(watchFiles);
        this.addResources(...resources
            .filter((filePath) => filePath !== testFile.path && filePath !== this.entryPoint.path)
        );

        await bundler.write();
        // GC
        bundler = null;

        this.emit(BrowserTestRunner.PREPARE_END_EVENT);
    }

    async run() {
        await super.run(this.entryPoint);
        let id = this.runId;
        let config = clone(this.config);
        config.files = config.files || [];
        config.files.unshift(
            {
                pattern: this.entryPoint.path,
                included: true,
                served: true,
                nocache: true,
                watched: false,
            },
            {
                pattern: `${this.testDir.path}/**/*`,
                included: false,
                served: true,
                nocache: true,
                watched: false,
            },
        );

        let mainReporter = new Reporter();
        await new Promise((resolve, reject) => {
            let server = this.server = new karma.Server(config, () => {
                delete this.server;
                process.off('infrastructure_error', onError);
                resolve();
            });

            let reporters = [];
            let reportersMap = {};
            server.on('browser_register', (browser) => {
                let reporter = new Reporter(browser.name);
                reporters.push(reporter);
                reportersMap[browser.name] = reporter;
            });

            server.on('spec_complete', (browser, result) => {
                let reporter = reportersMap[browser.name];
                let path = [
                    ...(result.suite || []),
                    result.description,
                ];
                if (result.skipped) {
                    reporter.skip(path);
                } else if (result.success) {
                    reporter.pass(path);
                } else {
                    let error = result.assertionErrors.length ?
                        new Error(`${result.assertionErrors[0].name} ${result.assertionErrors[0].message}`) :
                        new Error('Unknown error');
                    if (result.log) {
                        error.stack = result.log.join('\n');
                    }
                    reporter.fail(path, error);
                }
                this.emit(BrowserTestRunner.RUN_PROGRESS_EVENT, reporter, path.join(' > '));
            });

            let onError = (error) => {
                reject(error);
                process.off('infrastructure_error', onError);
            };
            process.on('infrastructure_error', onError);

            server.on('browser_error', (browser, error) => {
                reject(error);
            });

            server.on('browsers_ready', () => {
                this.emit(BrowserTestRunner.RUN_START_EVENT, reporters);
            });

            server.on('browser_complete', async (browser, result) => {
                let reporter = reportersMap[browser.name];
                if (result && result.coverage) {
                    reporter.mergeCoverage(result.coverage);
                    await this.saveCoverage(reporter);
                }

                mainReporter.merge(reporter.getReport());
            });

            server.on('listening', () => {
                if (server.get('config').browsers.length) {
                    return;
                }
                this.stop();
            });

            server.start();
        });

        if (!this.isRunning(id)) {
            return;
        }

        this.done = true;
        this.emit(BrowserTestRunner.RUN_END_EVENT, mainReporter);

        return mainReporter;
    }

    /**
     * @inheritdoc
     */
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                karma.stopper.stop(this.server, resolve);
            });
        }
        return await super.stop();
    }
}

module.exports = BrowserTestRunner;
