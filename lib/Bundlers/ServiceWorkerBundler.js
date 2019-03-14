const ScriptBundler = require('./ScriptBundler');

/**
 * Generate a service worker.
 */
class ServiceWorkerBundler extends ScriptBundler {
    /**
     * @inheritdoc
     */
    async build() {
        await super.build();
        console.log(this);
    }
}

module.exports = ServiceWorkerBundler;
