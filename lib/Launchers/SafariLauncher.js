const BrowserLauncher = require('./BrowserLauncher');
const ps = require('ps-node');

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
        await super.quit();

        await new Promise((resolve) => {
            ps.lookup({
                command: '/Applications/Safari.app/Contents/MacOS/Safari',
                arguments: '--automation',
            }, async (err, list) => {
                if (err) {
                    return resolve([]);
                }
                await Promise.all(
                    list.map(async (process) => await new Promise((resolveKill) => ps.kill(process.pid, resolveKill)))
                );
                resolve(list);
            });
        });
    }
}

module.exports = SafariLauncher;
