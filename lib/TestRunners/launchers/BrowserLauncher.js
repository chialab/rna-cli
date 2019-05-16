const webdriver = require('selenium-webdriver');

class BrowserLauncher {
    get name() {
        throw new Error('a name is required for browser');
    }

    constructor() {
        this.initialize(webdriver);
    }

    async initialize() { }

    async goto(url) {
        if (!this.driver) {
            throw new Error(`${this.name} driver is not instantiated`);
        }
        await this.driver.get(url);
    }

    async quit() {
        if (!this.driver) {
            throw new Error(`${this.name} driver is not instantiated`);
        }
        return await this.driver.quit();
    }
}

module.exports = BrowserLauncher;
