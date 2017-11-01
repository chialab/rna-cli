const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const paths = require('../../../lib/paths.js');

/**
 * Ensure package has a license.
 *
 * @param {CLI} app CLI.
 * @param {Object} options Options.
 * @returns {Promise}
 */
module.exports = (app, options) => {
    if (options.license !== false) {
        const cwd = paths.cwd;
        const jsonFile = path.join(cwd, 'package.json');
        if (!fs.existsSync(jsonFile)) {
            return global.Promise.resolve();
        }
        const json = require(jsonFile);
        const license = path.join(cwd, 'LICENSE');
        if (!fs.existsSync(license) || options.force) {
            let licenseCode = json.license.toLowerCase();
            if (licenseCode !== 'unlicensed') {
                // Package actually is licensed.
                let list = require('spdx-license-list/spdx-full.json');
                let licenses = {};
                Object.keys(list).forEach((key) => {
                    licenses[key.toLowerCase()] = list[key].licenseText;
                });
                let text = licenses[licenseCode];
                if (text) {
                    // Replace placeholders with actual values.
                    text = text.replace(/<year>/gi, (new Date()).getFullYear());
                    if (json.author) {
                        text = text.replace(/<(owner|author|copyright\sholders)>/gi, json.author);
                    }
                    fs.writeFileSync(license, text);
                    app.log(`${colors.green('license created.')} ${colors.grey(`(${license})`)}`);
                } else {
                    // We don't have a license document for the specified license code.
                    app.log(`${colors.red('invalid license.')} ${colors.grey(`(${jsonFile})`)}`);
                }
            } else {
                // Package is unlicensed.
                app.log(`${colors.yellow('no license found.')} ${colors.grey(`(${jsonFile})`)}`);
            }
        } else {
            // License already exists: leave it as is.
            app.log(`${colors.green('license found.')} ${colors.grey(`(${license})`)}`);
        }
    }
    return global.Promise.resolve();
};
