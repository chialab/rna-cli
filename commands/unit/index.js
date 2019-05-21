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
            const Watcher = require('../../lib/Watcher');

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

            if (!process.env.hasOwnProperty('NODE_ENV')) {
                // Set NODE_ENV environment variable.
                app.logger.info('setting "test" environment');
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

            let runners = await runTests(app, project, files, options, taskEnvironments);

            if (options.watch) {
                // setup a runners priority chain.
                const PriorityQueues = require('../../lib/PriorityQueues');
                const queue = new PriorityQueues();
                // start the watch task
                const watcher = new Watcher(project, {
                    ignore: (file) => !filterChangedRunners(runners, file).length,
                });

                watcher.on('change', (file) => {
                    let label = file.exists() ? 'changed' : 'removed';
                    app.logger.info(`\n${file.localPath} ${label}\n`);
                });

                await watcher.watch(async (file) => {
                    let promise = Promise.resolve();
                    let runnersWithChanges = filterChangedRunners(runners, file.path);

                    if (runnersWithChanges.length === 0) {
                        return true;
                    }

                    let ticks = await Promise.all(
                        // find out manifests with changed file dependency.
                        runnersWithChanges.map((runner) => queue.tick(runner, 100))
                    );

                    for (let i = 0; i < ticks.length; i++) {
                        if (!ticks[i]) {
                            continue;
                        }

                        let runner = runnersWithChanges[i];
                        promise = promise.then(async () => {
                            try {
                                await runner.run(files);
                            } catch (err) {
                                if (err) {
                                    app.logger.error(err);
                                }
                            }
                        });
                    }

                    await promise;
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
        printCoverageReport(app, coverageMap.toJSON());
    }

    if (finalExitCode) {
        throw new Error('some tests have failed');
    }

    return runners;
}

function filterChangedRunners(runners, file) {
    return runners
        .filter((runner) => {
            let runnerFiles = runner.files || [];
            return runnerFiles.includes(file);
        });
}

/**
 * Printe the coverage report in console.
 * @param {CLI} app The cli instance.
 * @param {Object} report The report to print.
 * @return {void}
 */
function printCoverageReport(app, report) {
    const utils = require('istanbul/lib/object-utils');
    const coverageFiles = Object.keys(report);
    if (!coverageFiles.length) {
        return;
    }
    let summaries = coverageFiles.map((coverageFile) => utils.summarizeFileCoverage(report[coverageFile]));
    let finalSummary = utils.mergeSummaryObjects.apply(null, summaries);
    app.logger.info('COVERAGE SUMMARY:');
    let statementsReport = formatCoverageReport(finalSummary, 'statements');
    app.logger[statementsReport.type](statementsReport.message);
    let branchesReport = formatCoverageReport(finalSummary, 'branches');
    app.logger[branchesReport.type](branchesReport.message);
    let functionsReport = formatCoverageReport(finalSummary, 'functions');
    app.logger[functionsReport.type](functionsReport.message);
    let linesReport = formatCoverageReport(finalSummary, 'lines');
    app.logger[linesReport.type](linesReport.message);
}

/**
 * Format coverage report metrics.
 * @param {Object} summary The full file coverage report.
 * @param {String} key The metric name.
 * @return {String}
 */
function formatCoverageReport(summary, key) {
    let metrics = summary[key];
    let skipped;
    let message;
    // Capitalize the field name
    let field = key.substring(0, 1).toUpperCase() + key.substring(1);
    if (field.length < 12) {
        // add extra spaces after the field name
        field += '                   '.substring(0, 12 - field.length);
    }
    message = `${field} : ${metrics.pct}% (${metrics.covered}/${metrics.total})`;
    skipped = metrics.skipped;
    if (skipped > 0) {
        message += `, ${skipped} ignored`;
    }
    let type = (metrics.pct >= 80 && 'success') ||
        (metrics.pct >= 50 && 'warn') ||
        'error';
    return {
        type,
        message,
    };
}
