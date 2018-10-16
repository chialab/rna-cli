const path = require('path');
const { mix } = require('@chialab/proteins');
const WebSocket = require('./WebSocket.js');
const JSDOM = require('jsdom').JSDOM;

module.exports = (SuperServerClass) => class extends mix(SuperServerClass).with(WebSocket) {
    constructor(options) {
        super(options);

        this.livereloadSockets = [];

        this.app.get('/livereload.js', (request, response) => {
            response.sendFile(path.join(__dirname, 'assets/livereload.js'));
        });

        this.app.use((request, response, next) => {
            let headers = request.headers;

            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return next();
            }

            if (headers.origin) {
                return next();
            }

            if (headers.accept && !headers.accept.includes('text/html')) {
                return next();
            }

            response.on('pipe', (stream) => {
                if (!response.livereloadInject) {
                    response.livereloadInject = true;
                    stream.unpipe(response);
                    let data = '';
                    stream.on('data', (chunk) => {
                        data += chunk.toString();
                    });
                    stream.on('end', () => {
                        if (!response.getHeader('content-type').includes('text/html')) {
                            response.send(data);
                            return;
                        }

                        try {
                            let dom = new JSDOM(data, {
                                url: 'https://example.org/',
                                referrer: 'https://example.com/',
                            });

                            let node = dom.window.document.body || dom.window.document.head;
                            if (node) {
                                node.innerHTML += '<script src="/livereload.js"></script>';
                            }
                            response.send(dom.serialize());
                        } catch (error) {
                            // eslint-disable-next-line
                            console.error(error);
                            response.send(data);
                        }
                    });
                }
            });

            next();
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
