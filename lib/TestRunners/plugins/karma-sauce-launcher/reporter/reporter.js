const fetch = require('node-fetch');

/**
 * Karma browser reported that updates corresponding Saucelabs jobs whenever a given
 * browser finishes.
 */
function SaucelabsReporter(logger, browserMap) {
    const log = logger.create('reporter.sauce');
    let pendingUpdates = [];
    // This fires whenever any browser completes. This is when we want to report results
    // to the Saucelabs API, so that people can create coverage banners for their project.
    this.onBrowserComplete = function(browser) {
        const result = browser.lastResult;
        const browserId = browser.id;
        if (result.disconnected) {
            log.error('✖ Browser disconnected');
        }
        if (result.error) {
            log.error('✖ Tests errored');
        }
        const browserData = browserMap.get(browserId);
        // Do nothing if the current browser has not been launched through the Saucelabs launcher
        if (!browserData) {
            return;
        }
        const { username, accessKey, sessionId } = browserData;
        const url = `https://${username}:${accessKey}@saucelabs.com/rest/v1/${username}/jobs/${sessionId}`;
        const hasPassed = !(result.failed || result.error || result.disconnected);
        // Update the job by reporting the test results. Also we need to store the promise here
        // because in case "onExit" is being called, we want to wait for the API calls to finish.
        pendingUpdates.push(
            fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'passed': hasPassed,
                    'custom-data': result,
                }),
            }).then(async (response) => {
                let json = await response.json();
                if (!response.ok) {
                    throw json;
                }
                return json;
            }).catch(error => log.error('Could not report results to Saucelabs: %s', error))
        );
    };
    // Whenever this method is being called, we just need to wait for all API calls to finish,
    // and then we can notify Karma about proceeding with the exit.
    this.onExit = async (doneFn) => {
        await Promise.all(pendingUpdates);
        doneFn();
    };
}

exports.SaucelabsReporter = SaucelabsReporter;
