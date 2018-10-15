const SafariLauncher = require('../../../../lib/Launchers/SafariLauncher');

function Safari(baseBrowserDecorator) {
    baseBrowserDecorator(this);

    this.name = 'Safari';

    this.driver = new SafariLauncher();

    this._start = async (url) => {
        await this.driver.goto(url);
    };

    this.on('kill', (done) => {
        if (this.driver) {
            this.driver.quit()
                .then(done)
                .catch(done);
        } else {
            done();
        }
    });
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
