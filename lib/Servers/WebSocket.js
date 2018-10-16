const expressWs = require('express-ws');

module.exports = (SuperServerClass) => class extends SuperServerClass {
    constructor(options) {
        super(options);
        expressWs(this.app, this.server);
    }
};
