const path = require('path');
const { mix } = require('@chialab/proteins');
const WebSocket = require('./WebSocket.js');

module.exports = (SuperServerClass) => class extends mix(SuperServerClass).with(WebSocket) {
    constructor(options) {
        super(options);

        this.livereloadSockets = [];

        this.app.get('/livereload.js', (request, response) => {
            response.sendFile(path.join(__dirname, 'assets/livereload.js'));
        });

        this.app.ws('/livereload', (ws) => {
            this.livereloadSockets.push(ws);

            ws.on('close', () => {
                this.livereloadSockets.splice(this.livereloadSockets.indexOf(ws), 1);
            });
        });
    }

    async reload(file) {
        this.livereloadSockets.forEach((ws) => {
            ws.send(JSON.stringify({
                type: 'message',
                date: Date.now(),
                file,
            }));
        });
    }
};
