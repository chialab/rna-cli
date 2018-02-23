/**
 * @class PriorityQueues
 * Create priority queues.
 */
module.exports = class PriorityQueues {
    constructor() {
        this.queues = new global.Map();
    }

    /**
     * Return a promise that resolves after the given amount of time, relative to a id.
     * Every time the `tick` method is called, the previous timeout for that id will be canceled.
     *
     * @param {*} ref Queue reference.
     * @param {integer} time Timeout before resolution.
     * @return {Promise}
     */
    tick(ref, time) {
        if (this.queues.has(ref)) {
            // Timeout was previously set. Reject previous promise and clear previously set timeout.
            this.queues.get(ref).reject();
            clearInterval(this.queues.get(ref).timeout);
        }
        return new global.Promise((resolve, reject) => {
            this.queues.set(ref, {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    // Resolve promise and push self-destruction button.
                    resolve();
                    this.queues.delete(ref);
                }, time),
            });
        });
    }
}
