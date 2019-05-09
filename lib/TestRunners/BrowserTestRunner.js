const fs = require('fs');
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

class BrowserTestRunner extends TestRunner {
    async setup(options = {}) {
        await super.setup(options);

        let config;
        let localConf = this.project.file('karma.conf.js');
        if (localConf.exists()) {
            // Local Karma config exists. Use that.
            config = karma.config.parseConfig(localConf.path);
        } else {
            config = {
                // base path that will be used to resolve all patterns (eg. files, exclude)
                basePath: options.basePath || this.project.path,

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
                singleRun: true,

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
        }
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
            config.customLaunchers = {
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
            };

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
            const saucelabs = require('../../lib/saucelabs');

            let job = (process.env.TRAVIS && `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})`) ||
                (process.env.GITLAB_CI && `GITLAB # ${process.env.CI_JOB_NAME} (${process.env.CI_JOB_ID})`) ||
                `RNA # ${Date.now()}`;

            // SauceLabs configuration.
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
                testName: getTestName(this.project),
            };

            let saucelabsBrowsers = await saucelabs.launchers(options.targets);
            config.customLaunchers = saucelabsBrowsers;
            config.browsers = Object.keys(saucelabsBrowsers);
            if (config.browsers.length === 0) {
                throw new Error('invalid SauceLabs targets.');
            }
            config.plugins.push(require('./plugins/karma-sauce-launcher/index.js'));
        }

        if (options.electron) {
            // Test on Electron.
            config.browsers = ['ElectronBrowser'];
            config.customLaunchers = {
                ElectronBrowser: {
                    base: 'Electron',
                    tmpdir: this.app.store.tmpdir('ElectronTest').path,
                },
            };
            config.plugins.push(require('./plugins/karma-electron-launcher/index.js'));
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
                dir: this.project.directory('reports/coverage').path,
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
            config.reporters.push('coverage');
        }

        config.preprocessors = config.preprocessors || {};
        config.preprocessors['**/*.js'] = config.preprocessors['**/*.js'] || [];
        config.preprocessors['**/*.js'].push('rna', 'sourcemap');
        this.config = config;
        this.compilerCache = {};
    }

    async run(files) {
        await super.run(files);
        const runner = this;
        const { app, project, options, compilerCache } = this;
        const config = Object.assign({}, this.config);
        config.files = config.files || [];
        config.files.unshift(...files.map((file) => (
            {
                pattern: file.path,
                included: true,
                served: true,
                nocache: false,
                watched: false,
            }
        )));
        config.plugins = config.plugins || [];
        config.plugins.push({
            'preprocessor:rna': ['factory', function() {
                return async function(content, karmaFile, done) {
                    let file = files.find((file) => file.path === karmaFile.path);
                    if (!file) {
                        return done(content);
                    }
                    let bundler;
                    if (file.path in compilerCache) {
                        bundler = compilerCache[file.path].bundler;
                    } else {
                        bundler = new ScriptBundler(app, project);
                        await bundler.setup({
                            input: file,
                            output: file,
                            format: 'umd',
                            targets: options.targets,
                            map: 'inline',
                            assertions: true,
                            lint: false,
                            analyze: false,
                            polyfill: false,
                            typings: false,
                            progress: false,
                            jsx: {
                                module: options['jsx.module'],
                                pragma: options['jsx.pragma'],
                                pragmaFrag: options['jsx.pragmaFrag'],
                            },
                        });
                    }
                    const { code, watchFiles } = await bundler.build();
                    compilerCache[file.path] = {
                        bundler,
                        code,
                    };
                    runner.addResources(...watchFiles.filter((filePath) => fs.existsSync(filePath)));
                    done(code);
                };
            }],
        });

        return await new Promise((resolve) => {
            const coverageMap = require('istanbul-lib-coverage').createCoverageMap({});

            let failed = 0;
            const server = new karma.Server(config, (exitCode) => {
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
                if (result.failed) {
                    failed = result.failed;
                }
            });

            server.start();
        });
    }
}

module.exports = BrowserTestRunner;
