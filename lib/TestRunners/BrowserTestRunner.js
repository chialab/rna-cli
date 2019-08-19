const { existsSync } = require('fs');
const path = require('path');
const ScriptBundler = require('../Bundlers/ScriptBundler');
const TestRunner = require('./TestRunner');
const Targets = require('../Targets');
const karma = require('karma');

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

    const branchName = project.git.getBranchName();
    const commit = project.git.getShortCommitCode();
    const commitMessage = project.git.getCommitMessage();

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

class BrowserTestRunner extends TestRunner {
    async setup(options = {}) {
        await super.setup(options);

        let targets = Targets.parse(options.targets);
        let config = {
            // base path that will be used to resolve all patterns (eg. files, exclude)
            basePath: options.root.path,

            // options object to be used by Node's https class
            httpsServerOptions: options.https,

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
            browserDisconnectTimeout: 2 * 6 * 1000,
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

            // context if any
            customContextFile: options.context && options.context.path,

            plugins: [
                require('karma-sourcemap-loader'),
                require('karma-mocha'),
                require('./plugins/karma-mocha-reporter/index.js'),
                require('./plugins/karma-chai/index.js'),
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
            const launchers = ['chrome', 'firefox', 'ie', 'edge', 'opera', 'safari'];

            config.frameworks.push('detectBrowsers');
            config.plugins.push(
                require('karma-chrome-launcher'),
                require('karma-firefox-launcher'),
                require('karma-ie-launcher'),
                require('karma-edge-launcher'),
                require('karma-opera-launcher'),
                require('./plugins/karma-safari-launcher/karma-safari-launcher'),
                require('karma-detect-browsers')
            );
            config.customLaunchers = Object.assign({}, config.customLaunchers || {}, {
                Chrome_CI: {
                    base: 'Chrome',
                    flags: ['--no-sandbox'],
                },
                Firefox_CI: {
                    base: 'Firefox',
                    prefs: {
                        'app.update.enabled': false,
                        'browser.search.update': false,
                        'extensions.update.enabled': false,
                        'datareporting.policy.firstRunURL': '',
                    },
                    extensions: [],
                },
            });

            config.detectBrowsers = {
                usePhantomJS: false,
                postDetection: (availableBrowser) => {
                    let filtered = launchers;
                    if (typeof options.browser === 'string') {
                        filtered = options.browser.split(/[\s-_,]{1,}/)
                            .filter((browserName) => launchers.includes(browserName.toLowerCase()));
                    }
                    // remove available browsers without a launcher.
                    availableBrowser = availableBrowser
                        .filter((browserName) => filtered.includes(browserName.toLowerCase()));
                    // we are replacing the detected `Chrome` with the `Chrome_CI` configuration.
                    const ioChrome = availableBrowser.indexOf('Chrome');
                    if (ioChrome !== -1) {
                        availableBrowser.splice(ioChrome, 1, 'Chrome_CI');
                    }
                    const ioFirefox = availableBrowser.indexOf('Firefox');
                    if (ioFirefox !== -1) {
                        availableBrowser.splice(ioFirefox, 1, 'Firefox_CI');
                    }
                    return availableBrowser;
                },
            };
        }

        if (options.saucelabs) {
            let job = (process.env.TRAVIS && `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})`) ||
                (process.env.GITLAB_CI && `GITLAB # ${process.env.CI_JOB_NAME} (${process.env.CI_JOB_ID})`) ||
                `RNA # ${Date.now()}`;

            // SauceLabs configuration.
            config.hostname = '127.0.0.1.xip.io';
            config.retryLimit = 0;
            config.reporters.push('saucelabs');
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

        if (options.coverage) {
            // Collect code coverage.
            config.plugins.push('karma-coverage');
            config.coverageReporter = {
                reporters: [
                    {
                        type: 'in-memory',
                    },
                ],
            };
            config.reporters.push('coverage');
        }

        config.preprocessors = config.preprocessors || {};
        config.preprocessors['**/*.js'] = config.preprocessors['**/*.js'] || [];
        config.preprocessors['**/*.jsx'] = config.preprocessors['**/*.jsx'] || [];
        config.preprocessors['**/*.mjs'] = config.preprocessors['**/*.mjs'] || [];
        config.preprocessors['**/*.ts'] = config.preprocessors['**/*.ts'] || [];
        config.preprocessors['**/*.tsx'] = config.preprocessors['**/*.tsx'] || [];
        config.preprocessors['**/*.js'].push('sourcemap');
        config.preprocessors['**/*.jsx'].push('sourcemap');
        config.preprocessors['**/*.mjs'].push('sourcemap');
        config.preprocessors['**/*.ts'].push('sourcemap');
        config.preprocessors['**/*.tsx'].push('sourcemap');
        this.config = config;
        this.compilerCache = {};
    }

    async run(files) {
        await super.run(files);

        const bundler = new ScriptBundler();
        const inputCode = files
            .filter((file) => file.path.indexOf(this.testDir.path) !== 0)
            .filter((file) => file.path.indexOf(this.coverageDir.path) !== 0)
            .map((file) => `import '${file.path}';`).join('\n');
        const testFile = this.testDir.file('__specs__.js');
        const indexFile = this.testDir.file('__entry__.js');

        this.emit(BrowserTestRunner.START_EVENT);

        this.emit(BrowserTestRunner.PREPARE_START_EVENT);
        indexFile.write(`var karmaLoad = window.__karma__.loaded.bind(window.__karma__);
var karmaStart = window.__karma__.start.bind(window.__karma__);
window.__karma__.loaded = function() {};
window.__karma__.start = function() {};
System.import('./base/${this.options.root.relative(testFile)}').then(function() { karmaStart(); })`);
        await bundler.setup({
            code: inputCode,
            input: testFile,
            root: this.options.root,
            output: this.testDir,
            format: 'system',
            targets: this.options.targets,
            bundle: true,
            map: 'inline',
            assertions: true,
            lint: false,
            analyze: false,
            typings: false,
            progress: false,
            coverage: this.options.coverage,
            polyfill: this.options.polyfill,
            jsx: {
                module: this.options['jsx.module'],
                pragma: this.options['jsx.pragma'],
                pragmaFrag: this.options['jsx.pragmaFrag'],
            },
        });

        const { watchFiles } = await bundler.build();
        await bundler.write();

        this.emit(BrowserTestRunner.PREPARE_END_EVENT);

        this.addResources(...watchFiles.filter((filePath) => existsSync(filePath)));

        const config = Object.assign({}, this.config);
        config.files = config.files || [];
        config.files.unshift(
            {
                pattern: require('resolve').sync('systemjs/dist/s.min.js', {
                    basedir: __dirname,
                }),
                included: true,
                served: true,
                nocache: false,
                watched: false,
            },
            {
                pattern: indexFile.path,
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

        this.result = await new Promise((resolve) => {
            let failed = 0;
            const server = new karma.Server(config, (exitCode) => {
                resolve({
                    exitCode,
                    failed,
                    coverage: this.coverageMap.toJSON(),
                });
            });

            server.on('coverage_complete', (browser, coverageReport) => {
                this.reportCoverage(coverageReport, browser.name);
            });

            server.on('run_complete', (browser, result) => {
                if (result.failed) {
                    failed = result.failed;
                }
            });

            server.start();
        });

        this.emit(BrowserTestRunner.END_EVENT);

        return this.result;
    }
}

module.exports = BrowserTestRunner;
