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
    async add(callback) {
        // Add something to do in queue.
        try {
            await this.queue;
        } catch (err) {
            // Ignore previous errors.
        }
        return await callback();
    }
};
