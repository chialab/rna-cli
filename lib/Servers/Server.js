const fs = require('fs');
const httpModule = require('http');
const httpsModule = require('https');
const { hostname } = require('os');
const express = require('express');

class Server {
    get listening() {
        return this.server && this.server.listening;
    }

    get address() {
        if (!this.server) {
            return null;
        }
        let port = this.server.address().port;
        let host = hostname();
        return {
            host,
            port,
            url: `${this.options.https ? 'https' : 'http'}://${host}:${port}`,
        };
    }

    constructor(options = {}) {
        this.options = Object.assign({}, options);

        const { https } = this.options;

        this.app = express();

        if (https) {
            this.server = httpsModule.createServer({
                key: fs.readFileSync(https.key),
                cert: fs.readFileSync(https.cert),
            }, this.app);
        } else {
            this.server = httpModule.createServer(this.app);
        }
    }

    async listen() {
        const { port } = this.options;

        return new Promise((resolve, reject) => {
            this.server.listen(port || 8080, '0.0.0.0', (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async close() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = Server;
