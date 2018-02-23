/**
 * @class Queue
 * Create a queue of Promises.
 */
module.exports = class Queue {
    constructor() {
        this.queue = global.Promise.resolve();
    }

    /**
     * Add a callback to the queue.
     * @param {Function} callback
     * @return {Promise}
     */
    add(callback) {
        // Add something to do in queue.
        this.queue = this.queue
            .catch(() => global.Promise.resolve()) // Ignore previous errors.
            .then(() => {
                let res;
                try {
                    res = callback();
                    // if the response is not a promise, wrap it.
                    if (!(res instanceof global.Promise)) {
                        res = global.Promise.resolve(res);
                    }
                } catch (err) {
                    // if the callback is not async, catch any error and resolve the queue.
                    res = global.Promise.resolve();
                }
                return res;
            });
        return this.queue;
    }
};
