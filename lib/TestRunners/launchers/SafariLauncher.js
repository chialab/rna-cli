const BrowserLauncher = require('./BrowserLauncher');
const { execSync } = require('child_process');
const os = require('os');

async function sleep(time) {
    return await new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

const nameMap = new Map([
    [19, 'Catalina'],
    [18, 'Mojave'],
    [17, 'High Sierra'],
    [16, 'Sierra'],
    [15, 'El Capitan'],
    [14, 'Yosemite'],
    [13, 'Mavericks'],
    [12, 'Mountain Lion'],
    [11, 'Lion'],
    [10, 'Snow Leopard'],
    [9, 'Leopard'],
    [8, 'Tiger'],
    [7, 'Panther'],
    [6, 'Jaguar'],
    [5, 'Puma']
]);

class SafariLauncher extends BrowserLauncher {
    get name() {
        return 'safari';
    }

    async initialize(webdriver) {
        let flags;
        if (os.platform() === 'darwin') {
            let version = Number(os.release().split('.')[0]) - 4;
            if (version < 15) {
                flags = '--legacy';
            }
        }

        const safari = require('selenium-webdriver/safari');
        const service = (new safari.ServiceBuilder()).addArguments(flags).build();

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
