const targetsParser = require('@babel/preset-env/lib/targets-parser').default;
const { isPluginRequired } = require('@babel/preset-env/lib/index');
const browserslist = require('browserslist');
const { fetchJSON } = require('./fetch');


/**
 * Handle scripts and css targets.
 * @property {Object} targets A set of targeted browsers (key => browser name, value => min browser version).
 */
class Targets {
    /**
     * Transform a Browserlist query or a Babel present env query to a Targets entry.
     * @param {string|string[]|Object} query Input query.
     * @return {Targets}
     */
    static parse(query) {
        if (query === 'esmodules') {
            let list = targetsParser({ esmodules: true });
            query = Object.keys(list).map((browser) => `${browser} ${list[browser].replace(/(\.0)*$/, '')}`).join(', ');
        } else if (query === 'node') {
            let list = targetsParser({ node: true });
            query = Object.keys(list).map((browser) => `${browser} ${list[browser].replace(/(\.0)*$/, '')}`).join(', ');
        } else if (Array.isArray(query)) {
            query = query.join(', ');
        } else if (typeof query === 'object') {
            query = Object.keys(query).map((browser) => `${browser} ${query[browser]}`).join(', ');
        }

        return new Targets(query);
    }

    /**
     * Create a Targets entry.
     * @param {string} query The Browserslist query.
     */
    constructor(query) {
        this.query = query;
    }

    /**
     * Check if targets matches the minimum required targets of a feature.
     * @param {Targets} supportTargets The minimum target of a feature.
     * @return {boolean}
     */
    check(supportTargets) {
        return !isPluginRequired(this.toObject(), supportTargets.toObject());
    }

    /**
     * Transform targets to a browser list query.
     * @return {string}
     */
    toQuery() {
        return this.query;
    }

    /**
     * Return a clone of the Targets set.
     * @return {Object}
     */
    toObject() {
        return targetsParser({ browsers: this.toQuery() });
    }

    /**
     * Return a list of browsers.
     * @return {Object}
     */
    toBrowsers() {
        return browserslist(this.query);
    }

    /**
     * Return SauceLabs browser descriptions.
     * @return {Object}
     */
    async toSauceLabs() {
        const data = await fetchJSON({
            host: 'saucelabs.com',
            path: '/rest/v1/info/platforms/all',
        });
        const browsers = this.toBrowsers();
        const result = {};

        browsers.forEach((entry) => {
            let apiName;
            let browserName = entry.split(' ')[0];
            let version = entry.split(' ')[1];
            if (version.includes('-')) {
                version = version.split('-')[1];
            }
            switch (browserName) {
                case 'chrome':
                    browserName = 'Google Chrome';
                    break;
                case 'firefox':
                    browserName = 'Firefox';
                    break;
                case 'edge':
                    browserName = 'Microsoft Edge';
                    break;
                case 'ie':
                    browserName = 'Internet Explorer';
                    break;
                case 'safari':
                    browserName = 'Safari';
                    break;
                case 'ios_saf':
                    browserName = 'Safari';
                    apiName = 'iphone';
                    break;
                case 'and_chr':
                case 'android':
                case 'and_uc':
                case 'samsung':
                    browserName = 'Android GoogleAPI Emulator';
                    apiName = 'android';
                    break;
                default:
                    return;
            }
            // find the correct vm configuration for the requested browser.
            let vms = data.filter((avm) => (avm.long_name === browserName || avm.api_name === apiName) && avm.short_version == version);
            if (!vms.length) {
                vms = data.filter((avm) => (avm.long_name === browserName || avm.api_name === apiName) && parseInt(avm.short_version) == parseInt(version));
            }

            let vm = vms.find((avm) => avm.os && avm.os.match(/windows/i)) || vms[0];

            // browserslist returns the version number for unreleased browsers
            // Saucelabs uses `beta` and `alpha` instead.
            if (!vm && (browserName === 'Google Chrome' || browserName === 'Firefox')) {
                let maxVersion = data
                    .filter((avm) => avm.long_name === browserName)
                    .reduce((max, avm) => {
                        if (parseInt(avm.short_version) > max) {
                            return parseInt(avm.short_version);
                        }
                        return max;
                    }, 0);

                if (maxVersion + 1 == version) {
                    vms = data.filter((avm) => avm.long_name === browserName && avm.short_version === 'beta');
                    vm = vms.find((avm) => avm.os && avm.os.match(/windows/i)) || vm[0];
                }

                // if (maxVersion + 2 == version) {
                //     vms = data.filter((avm) => avm.long_name === browserName && avm.short_version === 'dev');
                //     vm = vms.find((avm) => avm.os && avm.os.match(/windows/i)) || vm[0];
                // }
            }

            // since Android 5, browserslist returns only the latest available version of the Android webview.
            if (!vm && browserName === 'Android GoogleAPI Emulator' && parseInt(version) >= 5) {
                let maxVersion = 0;
                data.filter((avm) => avm.long_name === browserName).forEach((avm) => {
                    if (parseInt(avm.short_version) > maxVersion) {
                        maxVersion = parseInt(avm.short_version);
                        vm = avm;
                    }
                });
            }

            if (!vm) {
                return;
            }

            let config = {};
            config.browserName = vm.api_name;
            config.version = vm.short_version;
            config.platform = vm.os;
            if (vm.device) {
                config.deviceName = vm.device;
            }
            config.base = 'SauceLabs';
            result[`${(config.device || config.platform).replace(/\s+/g, '_')}-${config.browserName.replace(/\s+/g, '_')}-${config.version}`] = config;
        });
        return result;
    }
}

module.exports = Targets;
