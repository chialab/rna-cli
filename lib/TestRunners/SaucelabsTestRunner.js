const BrowserTestRunner = require('./BrowserTestRunner');
const Targets = require('../Targets');

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

class SaucelabsTestRunner extends BrowserTestRunner {
    get name() {
        return 'Saucelabs';
    }

    async setupBrowsers(options, config) {
        let targets = Targets.parse(options.browsers || options.targets);
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
}

module.exports = SaucelabsTestRunner;
