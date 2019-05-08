const BrowserLauncher = require('./BrowserLauncher');
const { execSync } = require('child_process');

async function sleep(time) {
    return await new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

class SafariLauncher extends BrowserLauncher {
    get name() {
        return 'safari';
    }

    async initialize(webdriver) {
        const safari = require('selenium-webdriver/safari');

        let service = (new safari.ServiceBuilder()).addArguments('--legacy').build();
        this.driver = new webdriver.Builder()
            .usingServer(service.start())
            .forBrowser('safari')
            .build();
    }

    async quit() {
        await this.driver.close();
        await sleep(1000);
        try {
            await super.quit();
        } catch (error) {
            //
        }
        try {
            execSync('kill $(ps -A | grep \'Safari --automation\' | head -1 | awk \'{print $1}\')');
        } catch (error) {
            //
        }
    }
}

module.exports = SafariLauncher;
