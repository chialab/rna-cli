const { SaucelabsLauncher } = require('./launcher');
const { SaucelabsReporter } = require('./reporter');
const { SauceConnect } = require('./local-tunnel/sauceconnect');

module.exports = {
    // TODO: make these injectable's classes by using factories.
    'launcher:SauceLabs': ['type', SaucelabsLauncher],
    'reporter:saucelabs': ['type', SaucelabsReporter],
    // Provide a service for establishing a SauceConnect tunnel.
    'SauceConnect': ['type', SauceConnect],
    // Provide a map that can be used to determine information about browsers that
    // have been launched with Saucelabs.
    'browserMap': ['value', new Map()],
};
