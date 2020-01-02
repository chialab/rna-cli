const { merge } = require('@chialab/proteins');
const targetsParser = require('@babel/preset-env/lib/targets-parser').default;
const { isPluginRequired } = require('@babel/preset-env/lib/index');
const browserslist = require('browserslist');
const { getJSON } = require('./Network');

/**
 * Map features to babel plugins.
 */
const FEATURES_MAP = {
    'module': 'es6.module',
    'async': 'transform-async-to-generator',
    'template-literals': 'transform-template-literals',
    'literals': 'transform-literals',
    'arrow-functions': 'transform-arrow-functions',
    'classes': 'transform-classes',
    'for-of': 'transform-for-of',
    'spread': 'transform-spread',
    'parameters': 'transform-parameters',
    'destructuring': 'transform-destructuring',
    'generator': 'transform-regenerator',
    'optional-catch': 'transform-optional-catch-binding',
};

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
     * Create a Targets instance for a set of features.
     * @param {string[]} features A list of features.
     * @return {Targets}
     */
    static fromFeatures(...features) {
        const data = merge(
            require('@babel/preset-env/data/built-in-modules.json'),
            require('@babel/preset-env/data/plugins.json'),
        );
        data['es6.module'].ios = data['es6.module'].ios_saf;
        delete data['es6.module'].ios_saf;

        features = features
            .map((name) => FEATURES_MAP[name] || `transform-${name}`)
            .filter((name) => name in data);

        const browsers = data[features[0]] || {};
        features
            .slice(1)
            .forEach((feature) => {
                const supported = data[feature];
                for (let browserName in supported) {
                    if (!browsers[browserName]) {
                        continue;
                    }
                    browsers[browserName] = parseFloat(browsers[browserName]) > parseFloat(supported[browserName]) ?
                        browsers[browserName] :
                        supported[browserName];
                }
            });

        const query = Object.keys(browsers).map((browser) => `${browser} ${browsers[browser]}`).join(', ');
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
        const data = await getJSON('https://saucelabs.com/rest/v1/info/platforms/all');
        if (!data || !Array.isArray(data)) {
            throw new Error('failed to fetch saucelabs browsers');
        }

        const result = {};
        let browsers = this.toBrowsers();

        // since Android 5, browserslist returns only the latest available version of the Android webview.
        const hasAndroid = browsers.find((entry) => entry.match(/android/));
        if (hasAndroid) {
            // remove android matches
            browsers = browsers.filter((entry) => !entry.match(/android/));

            // find out max android version supported
            let maxAndroidVersion = 0;
            data
                .filter((avm) => avm.long_name === 'Android GoogleAPI Emulator')
                .forEach((avm) => {
                    if (parseInt(avm.short_version) > maxAndroidVersion) {
                        maxAndroidVersion = parseInt(avm.short_version);
                    }
                });

            // add new browsers
            for (let i = 5; i <= maxAndroidVersion; i++) {
                browsers.push(`android ${i}`);
            }
        }

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

            if (!vm) {
                return;
            }

            let config = {};
            config.browserName = vm.api_name;
            config.version = vm.short_version;
            config.platform = vm.os;
            if (vm.device && vm.device !== 'android') {
                config.deviceName = vm.device;
            }
            config.base = 'SauceLabs';
            result[`${(config.device || config.platform).replace(/\s+/g, '_')}-${config.browserName.replace(/\s+/g, '_')}-${config.version}`] = config;
        });

        return result;
    }
}

module.exports = Targets;
