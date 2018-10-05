const fs = require('fs');
const httpModule = require('http');
const httpsModule = require('https');
const { hostname } = require('os');
const express = require('express');

class Server {
    static async detectPort(port = 3000) {
        if (port >= 10000) {
            return Promise.reject('Unable to find a port');
        }
        return await new Promise((resolve, reject) => {
            try {
                let server = httpModule.createServer();
                server.on('listening', () => {
                    server.close();
                    resolve(port);
                });
                server.on('error', () => {
                    reject();
                });
                server.listen(port, '0.0.0.0');
            } catch (err) {
                return Server.detectPort(port + 1);
            }
        }).catch(() =>
            Server.detectPort(port + 1)
        );
    }

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
        let { port } = this.options;

        if (!port) {
            port = await Server.detectPort();
        }

        return new Promise((resolve, reject) => {
            this.server.listen(port, '0.0.0.0', (error) => {
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
