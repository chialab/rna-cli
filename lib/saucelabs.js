const request = require('sync-request');
const git = require('./git.js');

function browserslistConfig(entry, data) {
    let name = entry.split(' ')[0];
    let apiName;
    let version = entry.split(' ')[1];
    if (version.includes('-')) {
        version = version.split('-')[1];
    }
    switch (name) {
        case 'chrome':
            name = 'Google Chrome';
            break;
        case 'firefox':
            name = 'Firefox';
            break;
        case 'edge':
            name = 'Microsoft Edge';
            break;
        case 'ie':
            name = 'Internet Explorer';
            break;
        case 'safari':
            name = 'Safari';
            break;
        case 'ios_saf':
            name = 'Safari';
            apiName = 'iphone';
            break;
        case 'and_chr':
        case 'android':
        case 'and_uc':
        case 'samsung':
            name = 'Android GoogleAPI Emulator';
            apiName = 'android';
            break;
        default:
            return null;
    }
    // find the correct vm configuration for the requested browser.
    let vm = data.find((vm) => (vm.long_name === name || vm.api_name === apiName) && vm.short_version == version) ||
        data.find((vm) => (vm.long_name === name || vm.api_name === apiName) && parseInt(vm.short_version) == parseInt(version));
    /**
     * browserslist returns the version number for unreleased browsers
     * Saucelabs uses `beta` and `alpha` instead.
     */
    if (!vm && (name === 'Google Chrome' || name === 'Firefox')) {
        let maxVersion = 0;
        data
            .filter((vm) => vm.long_name === name)
            .forEach((vm) => {
                if (parseInt(vm.short_version) > maxVersion) {
                    maxVersion = parseInt(vm.short_version);
                }
            });
        if (maxVersion + 1 == version) {
            vm = data.find((vm) => vm.long_name === name && vm.short_version === 'beta');
        }
    }
    // since Android 5, browserslist returns only the latest available version of the Android webview.
    if (!vm && name === 'Android GoogleAPI Emulator' && parseInt(version) >= 5) {
        let maxVersion = 0;
        data.filter((avm) => avm.long_name === name).forEach((avm) => {
            if (parseInt(avm.short_version) > maxVersion) {
                maxVersion = parseInt(avm.short_version);
                vm = avm;
            }
        });
    }
    if (!vm) {
        return null;
    }
    let config = {};
    config.browserName = vm.api_name;
    config.version = vm.short_version;
    config.platform = vm.os;
    if (vm.device) {
        config.device = vm.device;
    }
    return config;
}

module.exports = {
    fromBrowserslist(browsers) {
        const endpoint = 'https://saucelabs.com/rest/v1/info/platforms/all';
        const response = request('GET', endpoint);
        const data = JSON.parse(response.getBody('utf8'));
        const res = {};
        browsers
            .map((browser) => browserslistConfig(browser, data))
            .filter((def) => !!def)
            .forEach((browser) => {
                res[`${(browser.device || browser.platform).replace(/\s+/g, '_')}-${browser.browserName.replace(/\s+/g, '_')}-${browser.version}`] = browser;
            });
        return res;
    },

    launchers(browsers) {
        let res = this.fromBrowserslist(browsers);
        for (let k in res) {
            res[k].base = 'SauceLabs';
        }
        return res;
    },

    selenium(browsers) {
        let res = this.fromBrowserslist(browsers);
        for (let k in res) {
            let config = res[k];
            res[k] = {
                desiredCapabilities: config,
            };
        }
        return res;
    },

    getTestName(cwd, project, testType) {
        let name = `${testType} tests for ${project}`;
        const branchName = git.getBranchName(cwd);
        const commit = git.getShortCommitCode(cwd);
        const commitMessage = git.getCommitMessage(cwd);

        if (branchName) {
            name = `${name} in branch: ${branchName}`;
        }

        if (commit) {
            name = `${name}, ${commit}`;
        }

        if (commitMessage) {
            name = `${name}: '${commitMessage}'`;
        }

        return name;
    },
};
