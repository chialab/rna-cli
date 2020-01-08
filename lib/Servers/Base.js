const fs = require('fs');
const httpModule = require('http');
const httpsModule = require('https');
const { hostname } = require('os');
const express = require('express');

/**
 * @typedef {Object} ServerAddress
 * @property {string} host The server hostname.
 * @property {string} port The server port.
 * @property {string} url The complete server url.
 */

/**
 * @class Server
 * A Server helper for web apps.
 * It uses express for route handling.
 */
class Server {
    /**
     * Try to autodetect te first available port.
     * @param {number} port The initial port number.
     * @return {Promise<number>} The available port.
     */
    static async detectPort(port = 3000) {
        if (port >= 10000) {
            // stop to search for an available port.
            return Promise.reject('Unable to find a port');
        }
        return await new Promise((resolve, reject) => {
            try {
                // try to create a server which listens to the requested port.
                let server = httpModule.createServer();
                server.on('listening', () => {
                    // the port is available, close the current server.
                    server.close();
                    // resolve the port.
                    resolve(port);
                });
                server.on('error', () => {
                    // port is probably not available
                    reject();
                });
                server.listen(port, '0.0.0.0');
            } catch (err) {
                // try to detect the following port number.
                return Server.detectPort(port + 1);
            }
        }).catch(() =>
            // try to detect the following port number.
            Server.detectPort(port + 1)
        );
    }

    /**
     * Check if the server is running.
     * @type {boolean}
     */
    get listening() {
        return this.server && this.server.listening;
    }

    /**
     * Get the current server address.
     * @type {ServerAddress}
     */
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

    /**
     * Create a new Server instance.
     * @param {Object} options Server options.
     * @return {Server}
     */
    constructor(options = {}) {
        this.options = Object.assign({}, options);

        const { https } = this.options;

        this.app = express();

        if (https) {
            // use https server
            this.server = httpsModule.createServer({
                key: fs.readFileSync(https.key),
                cert: fs.readFileSync(https.cert),
            }, this.app);
        } else {
            // use http server
            this.server = httpModule.createServer(this.app);
        }
    }

    /**
     * Start the server.
     * @return {Promise}
     */
    async listen() {
        const port = this.options.port || await Server.detectPort();
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

    /**
     * Close the server.
     * @return {Promise}
     */
    async close() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = Server;
