const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const glob = require('glob');
const karma = require('karma');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');

function getSauceBrowsers() {
    let localConf = path.join(paths.cwd, 'sauce.brosers.js');
    if (fs.existsSync(localConf)) {
        return require(localConf);
    }
    return require('../../configs/unit/sauce.brosers.js');
}

function getConfig(app, options) {
    let localConf = path.join(paths.cwd, 'karma.conf.js');
    if (fs.existsSync(localConf)) {
        return localConf;
    }
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
            options.ci ? 'dots' : 'progress',
            'coverage',
        ],


        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: 'INFO',


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: [],


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: !options.server,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,

        customLaunchers: {
            Chrome_CI: {
                base: 'Chrome',
                flags: ['--no-sandbox'],
            },
        },
    };

    if (options.chrome !== false) {
        conf.browsers.push('Chrome_CI');
    }

    if (options.firefox !== false) {
        conf.browsers.push('Firefox');
    }

    if (options.ci) {
        conf.client = conf.client || {};
        conf.client.captureConsole = false;
        conf.autoWatch = false; 
        conf.logLevel = 'ERROR';
    }

    if (options.saucelabs) {
        conf.retryLimit = 3;
        conf.browserDisconnectTimeout = 10000;
        conf.browserDisconnectTolerance = 1;
        conf.browserNoActivityTimeout = 4 * 60 * 1000;
        conf.captureTimeout = 4 * 60 * 1000;
        conf.reporters = ['dots', 'saucelabs'];
        conf.sauceLabs = {
            startConnect: true,
            connectOptions: {
                'no-ssl-bump-domains': 'all',
                'username': process.env.SAUCE_USERNAME,
                'accessKey': process.env.SAUCE_ACCESS_KEY,
            },
            options: {},
            username: process.env.SAUCE_USERNAME,
            accessKey: process.env.SAUCE_ACCESS_KEY,
            build: process.env.TRAVIS ?
                `TRAVIS # ${process.env.TRAVIS_BUILD_NUMBER} (${process.env.TRAVIS_BUILD_ID})` :
                undefined,
            tunnelIdentifier: process.env.TRAVIS ?
                process.env.TRAVIS_JOB_NUMBER :
                undefined,
            recordScreenshots: true,
        };
        let saucelabsBrowsers = getSauceBrowsers();
        conf.customLaunchers = saucelabsBrowsers;
        conf.browsers = Object.keys(saucelabsBrowsers);
    }

    if (options.electron) {
        conf.browsers = ['Electron'];
        conf.client = conf.client || {};
        conf.client.useIframe = false;
    }

    if (options.coverage !== false) {
        conf.coverageReporter = {
            dir: 'coverage',
            reporters: [
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

module.exports = (program) => {
    program
        .command('unit')
        .description('Run project unit tests.')
        .help(`It uses \`karma\` (https://karma-runner.github.io/) to unit test the source code.

A default configuration is also provided.
Anyway, the developer can use a custom configuration if the \`karma.conf.js\` file exists in the root of the project.`)
        .option('--ci', 'Run in continuous integration mode.')
        .option('--saucelabs', 'Use saucelabs as browsers provider.')
        .option('--electron', 'Use electron.')
        .option('--no-coverage', 'Disable code coverage.')
        .option('--no-chrome', 'Do not start Chrome browser.')
        .option('--no-firefox', 'Do not start Firefox browser.')
        .action((app, options = {}) => {
            options = Proteins.clone(options);
            options.ci = options.hasOwnProperty('ci') ? options.ci : process.env.CI;
            if (!paths.cwd) {
                app.log(colors.red('no project found.'));
                return global.Promise.reject();
            }
            let config = getConfig(app, options);
            let files = [];
            let filter = optionsUtils.handleArguments(options);
            filter.files.forEach((f) => files.push(...glob.sync(f)));
            Object.values(filter.packages)
                .forEach((pkg) =>
                    files.push(...glob.sync(
                        path.join(pkg.path, '**/unit/**/*.spec.js'))
                    )
                );
            if (files.length) {
                // let tempDir = require('os').tmpdir();
                let tempDir = '/Users/edoardocavazza/Desktop';
                let tempSource = path.join(tempDir, `source-${Date.now()}.js`);
                let tempUnit = path.join(tempDir, `unit-${Date.now()}.js`);
                fs.writeFileSync(tempSource, files.map((uri) => `import '${uri}';`).join('\n'));
                return app.exec('build', {
                    arguments: [tempSource],
                    output: tempUnit,
                    map: false,
                }).then(() => {
                    let karmaOptions = typeof config === 'string' ?
                        { configFile: config } :
                        config;
                    karmaOptions.files = [tempUnit];
                    return new global.Promise((resolve) => {
                        let server = new karma.Server(karmaOptions, resolve);
                        server.start();
                    });
                });
            }
            app.log(colors.yellow('no unit tests found.'));
            return global.Promise.resolve();
        });
};