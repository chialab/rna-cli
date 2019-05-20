const express = require('express');
const compression = require('compression');
const serveIndex = require('serve-index');

module.exports = (SuperServerClass) => class extends SuperServerClass {
    constructor(options = {}) {
        super(options);

        if (options.compress) {
            this.app.use(compression());
        }

        if (options.base) {
            this.app.use(express.static(options.base));

            if (options.directory) {
                this.app.use(serveIndex(options.base, { icons: true }));
            }
        }

        if (options.static) {
            options.static.forEach((rule) => {
                this.app.use(rule.route, express.static(rule.dir));
                if (options.directory) {
                    this.app.use(rule.route, serveIndex(rule.dir, { icons: true }));
                }
            });
        }
    }
};
