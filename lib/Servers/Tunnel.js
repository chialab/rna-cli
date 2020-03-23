const ngrok = require('ngrok');

module.exports = (SuperServerClass) => class extends SuperServerClass {
    get address() {
        let address = super.address;
        if (this.tunnel) {
            address.tunnel = this.tunnel;
        }
        return address;
    }

    async listen() {
        await super.listen();

        let address = this.address;
        let url = await ngrok.connect({
            addr: address.port,
            // subdomain: typeof this.options.tunnel === 'string' && this.options.tunnel,
        });
        this.tunnel = url;
    }

    async close() {
        await super.close();
        if (this.tunnel) {
            await ngrok.disconnect(this.tunnel);
        }
    }
};
