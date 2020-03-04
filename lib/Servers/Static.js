const fs = require('fs');
const path = require('path');
const express = require('express');
const compression = require('compression');
const serveIndex = require('serve-index');
const cors = require('cors');

function html(base) {
    return function(req, res, next) {
        if (req.path.indexOf('.') === -1) {
            let file = path.join(base, `${req.path}.html`);
            if (fs.existsSync(file)) {
                req.url += '.html';
            }
        }
        next();
    };
}

module.exports = (SuperServerClass) => class extends SuperServerClass {
    constructor(options = {}) {
        super(options);

        if (options.compress) {
            this.app.use(compression());
        }

        if (options.base) {
            this.app.use(html(options.base));
            this.app.use(express.static(options.base));

            if (options.directory) {
                this.app.use(serveIndex(options.base, { icons: true }));
            }
        }

        if (options.static) {
            options.static.forEach((rule) => {
                this.app.use(rule.route, html(rule.dir));
                this.app.use(rule.route, express.static(rule.dir), cors());
                if (options.directory) {
                    this.app.use(rule.route, serveIndex(rule.dir, { icons: true }));
                }
            });
        }
    }
};
