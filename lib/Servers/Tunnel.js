const localtunnel = require('localtunnel');

module.exports = (SuperServerClass) => class extends SuperServerClass {
    get address() {
        let address = super.address;
        if (this.tunnel) {
            address.tunnel = this.tunnel.url;
        }
        return address;
    }

    async listen() {
        await super.listen();

        await new Promise((resolve, reject) => {
            let address = this.address;
            localtunnel(address.port, {
                subdomain: typeof this.options.tunnel === 'string' && this.options.tunnel,
            }, (error, client) => {
                if (error) {
                    reject(error);
                } else {
                    this.tunnel = client;
                    resolve();
                }
            });
        });
    }

    async close() {
        await super.close();
        if (this.tunnel) {
            this.tunnel.close();
        }
    }
};
