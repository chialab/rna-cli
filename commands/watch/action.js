const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const Proteins = require('@chialab/proteins');
const chokidar = require('chokidar');
const optionsUtils = require('../../lib/options.js');
const cwd = require('../../lib/paths.js').cwd;
const bundles = require('../../lib/bundles.js');
const wait = require('../../lib/watch-queue.js');

function formatPath(p) {
    return p.replace(cwd, '').replace(/^\/*/, '');
}

let current = {};
let scheduled = {};
let q = global.Promise.resolve();

function queue(app, cmd, options) {
    let f = options.arguments[0];
    if (scheduled[f]) {
        return scheduled[f];
    }
    q = q.then(() =>
        app.exec(cmd, options)
            .catch(() => global.Promise.resolve())
    );
    if (current[f]) {
        scheduled[f] = q;
    } else {
        current[f] = q;
    }
    q.then(() => {
        current[f] = scheduled[f];
        delete scheduled[f];
    });
    return q;
}

function findInBundles(bundles, file) {
    let res = [];
    Object.keys(bundles).forEach((bundleName) => {
        let bundle = bundles[bundleName];
        bundle.modules.forEach((mod) => {
            let deps = mod.dependencies || [];
            if (deps.indexOf(file) !== -1 && res.indexOf(bundleName) === -1) {
                res.push(bundleName);
            }
        });
    });
    return res;
}

module.exports = (app, options) => {
    if (!cwd) {
        app.log(colors.red('no project found.'));
        return global.Promise.reject();
    }
    let filter = optionsUtils.handleArguments(options);
    let watch = filter.files
        .concat(Object.values(filter.packages).map((pkg) => pkg.path))
        .filter((p) => fs.existsSync(p))
        .map((p) => {
            if (fs.statSync(p).isFile()) {
                return p;
            }
            return path.join(p, '**/*');
        });
    app.log(colors.bold('watching files...'));
    let ignored = options.exclude || [];
    if (!Array.isArray(ignored)) {
        ignored = [ignored];
    }
    ignored = ignored.map((p) => path.resolve(cwd, p));
    ignored.push(/(^\.|\/\.)/);
    chokidar.watch(watch, {
        ignored,
        ignoreInitial: true,
    }).on('all', (event, p) => {
        wait(p, 200).then(() => {
            let res = global.Promise.resolve();
            if (event === 'change') {
                app.log(colors.grey(`${formatPath(p)} changed.`));
                if (options.lint !== false) {
                    let opts = Proteins.clone(options);
                    opts.arguments = [p];
                    opts.warnings = false;
                    res = queue(app, 'lint', opts);
                }
            } else if (event === 'add') {
                app.log(colors.grey(`${formatPath(p)} created.`));
                if (options.lint !== false) {
                    let opts = Proteins.clone(options);
                    opts.arguments = [p];
                    opts.warnings = false;
                    res = queue(app, 'lint', opts);
                }
            } else if (event === 'unlink') {
                app.log(colors.grey(`${formatPath(p)} removed.`));
            }
            res.then((lintReports = []) => {
                if (lintReports.length === 0 && options.build !== false) {
                    let regenerate = findInBundles(bundles.generated, p);
                    if (regenerate.length) {
                        return global.Promise.all(
                            regenerate.map((f) => {
                                let opts = Proteins.clone(options);
                                opts.arguments = [f];
                                return queue(app, 'build', opts);
                            })
                        );
                    }
                }
                return global.Promise.resolve();
            }).catch((err) => {
                if (err) {
                    // eslint-disable-next-line
                    console.error(err);
                }
                return global.Promise.resolve();
            });
        }).catch(() => { });
    });
};