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
                        try {
                            let inject = '<script src="/livereload.js"></script>';
                            let doc = new JSDOM(data, {
                                url: 'https://example.org/',
                                referrer: 'https://example.com/',
                            }).window.document;
                            if (doc.body) {
                                doc.body.innerHTML += inject;
                            } else if (doc.head) {
                                doc.head.innerHTML += inject;
                            }
                            data = doc.documentElement.outerHTML;
                        } catch (error) {
                            //
                        }
                        response.send(data);
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
