function processConfig(config = {}, args = {}) {
    const username = config.username || process.env.SAUCE_USERNAME;
    const accessKey = config.accessKey || process.env.SAUCE_ACCESS_KEY;
    const startConnect = config.startConnect !== false;
    const seleniumHostUrl = `https://${username}:${accessKey}@ondemand.saucelabs.com:443/wd/hub`;
    const tunnelIdentifier = args.tunnelIdentifier || config.tunnelIdentifier || `karma-sauce-${Math.round(new Date().getTime() / 1000)}`;
    // TODO: This option is very ambiguous because it technically only affects the reporter. Consider
    // renaming in the future.
    const sauceApiProxy = args.proxy || config.proxy;
    // Browser name that will be printed out by Karma.
    const browserName = args.browserName +
        (args.version ? ` ${args.version}` : '') +
        (args.platform ? ` (${args.platform})` : '');

    const capabilitiesFromConfig = {
        tunnelIdentifier,
        'build': config.build,
        'commandTimeout': config.commandTimeout || 300,
        'customData': config.customData || {},
        'idleTimeout': config.idleTimeout || 90,
        'maxDuration': config.maxDuration || 1800,
        'name': config.testName || 'Saucelabs Launcher Tests',
        'parentTunnel': config.parentTunnel,
        'public': config.public || 'public',
        'recordScreenshots': config.recordScreenshots,
        'recordVideo': config.recordVideo,
        'tags': config.tags || [],
        'custom-data': config.customData,
    };

    const sauceConnectOptions = Object.assign({
        // By default, we just pass in the general Saucelabs credentials for establishing the
        // SauceConnect tunnel. This makes it possible to use "startConnect" with no additional setup.
        username,
        accessKey,
        tunnelIdentifier,
    }, config.connectOptions);

    const seleniumCapabilities = Object.assign({}, capabilitiesFromConfig, config.options, args);
    return {
        startConnect,
        sauceConnectOptions,
        sauceApiProxy,
        seleniumHostUrl,
        seleniumCapabilities,
        browserName,
        username,
        accessKey,
    };
}

exports.processConfig = processConfig;
