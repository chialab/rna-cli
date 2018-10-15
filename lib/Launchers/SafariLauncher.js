const BrowserLauncher = require('./BrowserLauncher');

class SafariLauncher extends BrowserLauncher {
    get name() {
        return 'safari';
    }

    async initialize(webdriver) {
        const safari = require('selenium-webdriver/safari');

        this.driver = new webdriver.Builder()
            .usingServer(new safari.ServiceBuilder().addArguments('--legacy').build().start())
            .forBrowser('safari')
            .build();
    }
}

module.exports = SafariLauncher;
