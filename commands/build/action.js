const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const paths = require('../../lib/paths.js');
const optionsUtils = require('../../lib/options.js');
const utils = require('../../lib/utils.js');
const bundle = require('./bundlers/rollup.js');
const sass = require('./bundlers/sass.js');

module.exports = (app, options = {}) => {
    app.generated = app.generated || {};
    app.generatedOptions = app.generatedOptions || {};
    options = Proteins.clone(options);
    if (!paths.cwd) {
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let filter = optionsUtils.handleArguments(options);
    let promise = global.Promise.resolve();
    Object.values(filter.packages).forEach((pkg) => {
        promise = promise.then(() => {
            let json = pkg.json;
            if (!json.main && !options.output) {
                app.log(colors.red(`Missing 'output' property for ${pkg.name} module.`));
                return global.Promise.reject();
            }
            let opts = Proteins.clone(options);
            if (json.module) {
                opts.input = path.join(pkg.path, json.module);
                opts.output = path.join(pkg.path, json.main);
            } else {
                opts.input = path.join(pkg.path, json.main);
            }
            opts.name = opts.name || utils.camelize(json.name);
            return bundle(app, opts);
        });
    });
    filter.files.forEach((file) => {
        promise = promise.then(() => {
            let opts = Proteins.clone(options);
            opts.input = file;
            if (opts.output) {
                if (filter.files.length > 1) {
                    opts.output = path.resolve(path.dirname(file), opts.output);
                }
            }
            if (['.scss', '.sass'].indexOf(path.extname(file)) !== -1) {
                return sass(app, opts);
            }
            return bundle(app, opts);
        });
    });

    return promise;
};