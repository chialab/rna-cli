const SafariLauncher = require('../../../../lib/Launchers/SafariLauncher');

function Safari(baseBrowserDecorator) {
    baseBrowserDecorator(this);

    this.name = 'Safari';

    this.browser = new SafariLauncher();

    this._start = async (url) => {
        try {
            await this.browser.goto(url);
        } catch (err) {
            return this._done('failure');
        }
        this._done();
    };

    let killingPromise;

    this.kill = async function() {
        // Already killed, or being killed.
        if (killingPromise) {
            return killingPromise;
        }

        this.state = this.STATE_BEING_KILLED;
        killingPromise = this.browser ? this.browser.quit() : Promise.resolve();
        await killingPromise;
        this.state = this.STATE_FINISHED;

        return killingPromise;
    };

    this.forceKill = function() {
        let killingPromise = this.kill();
        this.state = this.STATE_BEING_FORCE_KILLED;

        return killingPromise;
    };
}

Safari.prototype = {
    name: 'Safari',

    DEFAULT_CMD: {
        darwin: '/usr/bin/safaridriver',
    },
    ENV_CMD: 'SAFARI_BIN',
};

Safari.$inject = ['baseBrowserDecorator', 'args', 'logger'];

module.exports = {
    'launcher:Safari': ['type', Safari],
};
