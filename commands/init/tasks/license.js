/**
 * Ensure package has a license.
 *
 * @param {CLI} app CLI.
 * @param {Object} options The command options.
 * @param {Project} project The current project.
 * @param {NavigationDirectory} templates The templates directory.
 * @returns {Promise}
 */
module.exports = async function licenseTask(app, options, project) {
    const licenseFile = project.file('LICENSE');
    const licenseCode = (project.get('license') || 'unlicensed').toLowerCase();

    if (licenseCode === 'unlicensed') {
        // Package is unlicensed.
        if (licenseFile.exists()) {
            licenseFile.unlink();
        }
        app.logger.warn('no license found', project.localPath);
        return;
    }
    // Package actually is licensed.
    const list = require('spdx-license-list/spdx-full.json');
    const licenses = Object.keys(list).reduce((obj, key) => {
        obj[key.toLowerCase()] = list[key].licenseText;
        return obj;
    }, {});

    if (!(licenseCode in licenses)) {
        // We don't have a license document for the specified license code.
        app.logger.error('invalid license', project.localPath);
        return;
    }

    // Replace placeholders with actual values.
    const text = licenses[licenseCode]
        .replace(/<year>/gi, (new Date()).getFullYear())
        .replace(/<(owner|author|copyright\sholders)>/gi, () => {
            if (project.get('author')) {
                return project.get('author');
            }
        });

    licenseFile.write(text);
    app.logger.success('license updated', licenseFile.localPath);
};
