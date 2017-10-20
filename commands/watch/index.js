const fs = require('fs');
const path = require('path');
const optionsUtils = require('../../lib/options.js');
const Proteins = require('@chialab/proteins');
const chokidar = require('chokidar');
const cwd = require('../../lib/paths').cwd;

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

let bundles;

function findInBundles(file) {
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

module.exports = (program) => {
    program
        .command('watch')
        .description('Watch project files.')
        .help(`It uses \`chokidar\` to watch the project files changes, additions or remotions.
Everytime a change has been triggered, it runs the \`lint\` and \`build\` commands.`)
        .option('[file1] [file2] [package1] [package2] [package3]', 'The packages or files to watch.')
        .option('--no-lint', 'Disable lint on changes.')
        .option('--no-build', 'Disable build on changes.')
        .option('--exclude', 'Files to exclude (string, glob, array).')
        .action((app, options) => {
            if (!cwd) {
                app.log('No project found.'.red);
                return global.Promise.reject();
            }
            let buildPromise = global.Promise.resolve({});
            if (options.build !== false) {
                buildPromise = app.exec('build', options);
            }
            return buildPromise.then((buildBundles) => {
                bundles = buildBundles;
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
                let task = app.log('Watching files...'.bold, true);
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
                    if (task) {
                        task();
                        task = null;
                    }
                    let res = global.Promise.resolve();
                    if (event === 'change') {
                        app.log(`${formatPath(p)} changed.`.yellow);
                        if (options.lint !== false) {
                            let opts = Proteins.clone(options);
                            opts.arguments = [p];
                            opts.warning = false;
                            res = queue(app, 'lint', opts);
                        }
                    } else if (event === 'add') {
                        app.log(`${formatPath(p)} created.`.green);
                        if (options.lint !== false) {
                            let opts = Proteins.clone(options);
                            opts.arguments = [p];
                            opts.warning = false;
                            res = queue(app, 'lint', opts);
                        }
                    } else if (event === 'unlink') {
                        app.log(`${formatPath(p)} removed.`.red);
                    }
                    res.then((lintReports = []) => {
                        if (lintReports.length === 0 && options.build !== false) {
                            let opts = Proteins.clone(options);
                            opts.arguments = findInBundles(p);
                            if (opts.arguments.length) {
                                return queue(app, 'build', opts);
                            }
                        }
                        return global.Promise.resolve();
                    }).then(() => {
                        task = app.log('Watching files...'.bold, true);
                    });
                });
            });
        });
};