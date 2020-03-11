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

        let address = this.address;
        this.tunnel = await localtunnel({
            host: 'http://serverless.social',
            port: address.port,
            subdomain: typeof this.options.tunnel === 'string' && this.options.tunnel,
        });
    }

    async close() {
        await super.close();
        if (this.tunnel) {
            this.tunnel.close();
        }
    }
};
