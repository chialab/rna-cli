const fs = require('fs');
const path = require('path');
const optionsUtils = require('../../lib/options.js');
const Proteins = require('@chialab/proteins');
const chokidar = require('chokidar');
const cwd = require('../../lib/paths').cwd;
const bundles = require('../../lib/bundles');

function formatPath(p) {
    return p.replace(cwd, '').replace(/^\/*/, '');
}

let q = global.Promise.resolve();
function queue(app,cmd, options) {
    q = q.then(() =>
        app.exec(cmd, options)
    );
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

let interval;

function wait(clb, time) {
    return new global.Promise((resolve, reject) => {
        clearInterval(interval);
        interval = setTimeout(() => {
            clb()
                .then((res) => resolve(res))
                .catch((err) => reject(err));
        }, time);
    });
}

module.exports = (program) => {
    program
        .command('watch')
        .description('Watch project files.')
        .help(`It uses \`chokidar\` to watch the project files changes, additions or remotions.
Everytime a change has been triggered, it runs the \`lint\` and \`build\` commands.`)
        .option('[file1] [file2] [package1] [package2] [package3]', 'The packages or files to watch.')
        .option('--exclude', 'Files to exclude (string, glob, array).')
        .option('--no-lint', 'Disable lint on changes.')
        .option('--no-build', 'Disable build on changes.')
        .action((app, options) => {
            if (!cwd) {
                app.log('no project found.'.red);
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
            app.log('watching files...'.bold);
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
                let res = wait(() => global.Promise.resolve(), 200);
                if (event === 'change') {
                    app.log(`${formatPath(p)} changed.`.grey);
                    if (options.lint !== false) {
                        let opts = Proteins.clone(options);
                        opts.arguments = [p];
                        opts.warning = false;
                        res = wait(() => queue(app, 'lint', opts), 200);
                    }
                } else if (event === 'add') {
                    app.log(`${formatPath(p)} created.`.grey);
                    if (options.lint !== false) {
                        let opts = Proteins.clone(options);
                        opts.arguments = [p];
                        opts.warning = false;
                        res = wait(() => queue(app, 'lint', opts), 200);
                    }
                } else if (event === 'unlink') {
                    app.log(`${formatPath(p)} removed.`.grey);
                }
                res
                    .then((lintReports = []) => {
                        if (lintReports.length === 0 && options.build !== false) {
                            let opts = Proteins.clone(options);
                            opts.arguments = findInBundles(bundles.generated, p);
                            if (opts.arguments.length) {
                                return queue(app, 'build', opts);
                            }
                        }
                        return global.Promise.resolve();
                    })
                    .catch((err) => {
                        if (err) {
                            // eslint-disable-next-line
                            console.error(err);
                        }
                        return global.Promise.resolve();
                    });
            });
        });
};