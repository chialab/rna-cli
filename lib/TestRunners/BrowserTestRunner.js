const TestRunner = require('./TestRunner');
const karma = require('karma');
const ScriptBundler = require('../Bundlers/ScriptBundler');

/**
 * Create a Test name using git status.
 * @param {Project} project The project to test.
 * @return {String}
 */
function getTestName(project) {
    const Git = require('../Git.js');

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

class BrowserTestRunner extends TestRunner {
    async setup(options = {}) {
        await super.setup(options);
        const karmaOptions = await getKarmaConfig(this.app, this.project, {
            basePath: this.project.path,
            watch: options.watch,
            coverage: options.coverage,
            targets: options.targets,
            concurrency: options.concurrency || (options.watch ? Infinity : undefined),
            timeout: options.timeout,
            customContextFile: options.context,
            saucelabs: !!options.saucelabs,
            electron: !!options.electron,
            browser: !!options.browser,
        });
        karmaOptions.files = [
            {
                pattern: '**/*',
                included: false,
                served: true,
                nocache: false,
                watched: false,
            },
        ];
        karmaOptions.preprocessors = karmaOptions.preprocessors || {};
        this.karmaOptions = karmaOptions;
    }

    async run(files) {
        const coverageMap = require('istanbul-lib-coverage').createCoverageMap({});
        const options = Object.assign({}, this.karmaOptions);
        const compiled = {};
        await Promise.all(
            files.map(async (file) => {
                const bundler = new ScriptBundler(this.app, this.project);
                await bundler.setup({
                    input: file,
                    output: file,
                    format: 'umd',
                    targets: this.options.targets,
                    map: 'inline',
                    assertions: true,
                    lint: false,
                    analyze: false,
                    polyfill: false,
                    typings: false,
                    progress: false,
                    jsx: {
                        module: this.options['jsx.module'],
                        pragma: this.options['jsx.pragma'],
                        pragmaFrag: this.options['jsx.pragmaFrag'],
                    },
                });
                const { code } = await bundler.build();
                compiled[file.path] = code;
            })
        );

        options.files.unshift(...files.map((file) => file.path));
        options.plugins = options.plugins || [];
        options.plugins.push({
            'preprocessor:rna': ['factory', function() {
                return function(content, file, done) {
                    if (file.path in compiled) {
                        done(compiled[file.path]);
                    } else {
                        done(content);
                    }
                };
            }],
        });
        options.preprocessors = options.preprocessors || {};
        options.preprocessors['**/*.js'] = options.preprocessors['**/*.js'] || [];
        options.preprocessors['**/*.js'].push('rna', 'sourcemap');

        return await new Promise((resolve) => {
            let failed = 0;
            const server = new karma.Server(this.karmaOptions, (exitCode) => {
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
}

module.exports = BrowserTestRunner;
