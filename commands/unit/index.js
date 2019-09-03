/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('unit')
        .description('Run project unit tests.')
        .readme(`${__dirname}/README.md`)
        .option('[--targets]', 'A supported browserslist query.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browser [browserName]]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use SauceLabs as browsers provider.')
        .option('[--coverage]', 'Generate a code coverage report.')
        .option('[--concurrency]', 'Set concurrency level for tests.')
        .option('[--context]', 'Use a specific HTML document for tests.')
        .option('[--timeout]', 'Set the tests timeout.')
        .option('[--watch]', 'Watch test files.')
        .action(async (app, options = {}) => {
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = new Project(cwd);

            // check sauce values
            if (options.saucelabs) {
                if (options['saucelabs.username']) {
                    process.env.SAUCE_USERNAME = options['saucelabs.username'];
                }
                if (options['saucelabs.key']) {
                    process.env.SAUCE_ACCESS_KEY = options['saucelabs.key'];
                }
                if (!process.env.SAUCE_USERNAME && app.store.get('saucelabs.username')) {
                    process.env.SAUCE_USERNAME = app.store.get('saucelabs.username');
                }
                if (!process.env.SAUCE_ACCESS_KEY && app.store.get('saucelabs.accessKey')) {
                    process.env.SAUCE_ACCESS_KEY = app.store.get('saucelabs.accessKey');
                }
                if (!process.env.SAUCE_USERNAME) {
                    throw new Error('missing SAUCE_USERNAME variable');
                }
                if (!process.env.SAUCE_ACCESS_KEY) {
                    throw new Error('missing SAUCE_ACCESS_KEY variable');
                }
            }

            if (!Object.prototype.hasOwnProperty.call(process.env, 'NODE_ENV')) {
                // Set NODE_ENV environment variable.
                app.logger.info('--------------------------\nsetting "test" environment\n--------------------------');
                process.env.NODE_ENV = 'test';
            }

            // Load options.
            options = Object.assign({}, options, {
                targets: options.targets || project.browserslist,
                root: project.directories.test || project.directory('test'),
                project,
            });

            // Load list of files to be tested.
            let files = [];

            if (options.arguments.length) {
                files = project.resolve(options.arguments)
                    .reduce((list, file) => {
                        if (!(file instanceof Project)) {
                            list.push(file);
                            return list;
                        }
                        let testDir = file.directories.test;
                        if (!testDir) {
                            testDir = file.directory('test');
                        }
                        if (testDir.exists()) {
                            list.push(...testDir.resolve('**/*.js'));
                        }
                        return list;
                    }, []);
            } else {
                let testDirs = [];
                let workspaces = project.workspaces;
                if (workspaces) {
                    workspaces.forEach((entry) => {
                        let testDir = entry.directories.test;
                        if (!testDir) {
                            testDir = entry.directory('test');
                        }
                        testDirs.push(testDir);
                    });
                } else {
                    let testDir = project.directories.test;
                    if (!testDir) {
                        testDir = project.directory('test');
                    }
                    testDirs.push(testDir);
                }
                files = testDirs
                    .reduce((list, directory) => {
                        if (directory.exists()) {
                            list.push(...directory.resolve('**/*.js'));
                        }
                        return list;
                    }, []);
            }

            if (!files.length) {
                app.logger.warn('no unit tests found.');
                return;
            }

            let taskEnvironments = [options.node && 'node', options.browser && 'browser', options.saucelabs && 'saucelabs'].filter(Boolean);
            if (!taskEnvironments.length) {
                // If test environment is not provide, use `browser` as default.
                taskEnvironments.push('node', 'browser');
                options.node = true;
                options.browser = true;
            }

            if (typeof options.context === 'string') {
                options.context = project.file(options.context);
            }

            let runners = await runTests(app, project, files, options, taskEnvironments);

            if (options.watch) {
                const collectedFiles = [];
                const statuses = new WeakMap();
                let promise = Promise.resolve();
                let timeout;

                const reRun = async (runner, requested) => {
                    const status = statuses.get(runner) || {};
                    if (requested) {
                        status.requested = true;
                    }
                    if (status.running) {
                        statuses.set(runner, status);
                        return;
                    }
                    if (!status.requested) {
                        return;
                    }
                    status.requested = false;
                    status.running = true;
                    statuses.set(runner, status);
                    promise = promise
                        .then(async () => {
                            try {
                                await runner.run(files);
                            } catch (err) {
                                if (err) {
                                    app.logger.error(err);
                                }
                            }
                        });
                    await promise;
                    status.running = false;
                    statuses.set(runner, status);
                    reRun(runner);
                };

                // start the watch task
                project.watch({
                    ignore: (file) => !filterChangedRunners(runners, [file]).length,
                }, async (eventType, file) => {
                    if (eventType === 'unlink') {
                        app.logger.info(`${file.localPath} removed`);
                    } else {
                        app.logger.info(`${file.localPath} changed`);
                    }

                    collectedFiles.push(file);
                    clearTimeout(timeout);

                    timeout = setTimeout(async () => {
                        const files = collectedFiles.slice(0);
                        collectedFiles.splice(0, collectedFiles.length);
                        await promise;

                        const runnersWithChanges = filterChangedRunners(runners, files);
                        if (runnersWithChanges.length === 0) {
                            return true;
                        }

                        for (let i = 0; i < runnersWithChanges.length; i++) {
                            reRun(runnersWithChanges[i], true);
                        }
                    }, 200);
                });
            }
        });
};

/**
 * Exec tests across multiple environments.
 * @param {CLI} app The current CLI instance.
 * @param {Project} project The active project.
 * @param {File[]} files The test files.
 * @param {Object} options A set of options for tests.
 * @param {Array<string>} environments A list of test environments.
 * @return {Promise<TestRunner[]>}
 */
async function runTests(app, project, files, options, environments = []) {
    const coverageMap = require('istanbul-lib-coverage').createCoverageMap({});

    let runners = [];
    let finalExitCode = 0;
    // Test built sources.
    for (let i = 0; i < environments.length; i++) {
        let taskEnvName = environments[i];

        if (taskEnvName === 'node') {
            // Startup Mocha.
            const NodeTestRunner = require('../../lib/TestRunners/NodeTestRunner');
            const runner = new NodeTestRunner();
            runners.push(runner);
            await runner.setup(options);
            runner.on(NodeTestRunner.PREPARE_START_EVENT, () => {
                app.logger.play('generating test...');
            });
            runner.on(NodeTestRunner.PREPARE_END_EVENT, () => {
                app.logger.stop();
            });
            let { exitCode, coverage } = await runner.run(files);
            if (coverage) {
                coverageMap.merge(coverage);
            }
            if (exitCode !== 0) {
                finalExitCode = exitCode;
            }
        } else if (taskEnvName === 'browser' || taskEnvName === 'saucelabs') {
            const BrowserTestRunner = require('../../lib/TestRunners/BrowserTestRunner');
            const runner = new BrowserTestRunner();
            runners.push(runner);
            await runner.setup(options);
            runner.on(BrowserTestRunner.PREPARE_START_EVENT, () => {
                app.logger.play('generating test...');
            });
            runner.on(BrowserTestRunner.PREPARE_END_EVENT, () => {
                app.logger.stop();
            });
            let { exitCode, coverage } = await runner.run(files);
            if (coverage) {
                coverageMap.merge(coverage);
            }
            if (exitCode !== 0) {
                finalExitCode = exitCode;
            }
        }
    }

    app.logger.newline();

    if (options.coverage) {
        printCoverageReport(app, coverageMap);
    }

    if (finalExitCode) {
        throw new Error('some tests have failed');
    }

    return runners;
}

function filterChangedRunners(runners, files) {
    return runners
        .filter((runner) => {
            const runnerFiles = runner.files || [];
            return files.some((file) => runnerFiles.includes(file.path));
        });
}

/**
 * Printe the coverage report in console.
 * @param {CLI} app The cli instance.
 * @param {Object} report The report to print.
 * @return {void}
 */
function printCoverageReport(app, report) {
    const colors = require('colors/safe');
    const summary = report.getCoverageSummary();
    const printLine = function(key) {
        const str = lineForKey(summary, key);
        let type = 'warn';
        if (summary[key].pct > 80) {
            type = 'success';
        } else if (!isNaN(summary[key].pct) && summary[key].pct < 50) {
            type = 'error';
        }
        app.logger[type](str);
    };

    app.logger.newline();
    app.logger.log(colors.underline('COVERAGE:'));
    printLine('statements');
    printLine('branches');
    printLine('functions');
    printLine('lines');
}

function lineForKey(summary, key) {
    const metrics = summary[key];
    key = key.substring(0, 1).toUpperCase() + key.substring(1);
    if (key.length < 12) {
        key += '                   '.substring(0, 12 - key.length);
    }
    const result = `${key}: ${metrics.pct}% (${metrics.covered}/${metrics.total})`;
    const skipped = metrics.skipped;
    if (skipped > 0) {
        return `${result}, ${skipped} ignored`;
    }
    return result;
}
