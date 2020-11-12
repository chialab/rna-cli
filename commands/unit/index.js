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
        .option('[--targets <string>]', 'A supported browserslist query.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browser [browserName]]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use SauceLabs as browsers provider.')
        .option('[--coverage]', 'Generate a code coverage report.')
        .option('[--concurrency <number>]', 'Set concurrency level for tests.')
        .option('[--context <path>]', 'Use a specific HTML document for tests.')
        .option('[--headless]', 'Run browsers in headless mode.')
        .option('[--loglevel <DISABLE|INFO|DEBUG|WARN|ERROR>]', 'Log level for tests.')
        .option('[--prepare]', 'Prepare tests build but skip run.')
        .option('[--run]', 'Skip tests build.')
        .option('[--timeout <number>]', 'Set the tests timeout.')
        .option('[--watch]', 'Watch test files.')
        .action(async (app, options = {}) => {
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = await Project.init(cwd);

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

            if (options.prepare) {
                delete options.run;
                delete options.watch;
                app.logger.warn('--prepare mode, tests will not run');
            }
            if (options.run) {
                delete options.watch;
                app.logger.warn('--run mode, skipping tests build');
            }

            // Load options.
            options = Object.assign({}, options, {
                targets: options.targets || await project.browserslist(),
                root: project.directories.test || project.directory('test'),
                project,
            });

            // Load list of files to be tested.
            let files = [];

            if (options.arguments.length) {
                files = [];

                let list = await project.resolve(options.arguments);
                for (let i = 0; i < list.length; i++) {
                    let file = list[i];
                    if (!(file instanceof Project)) {
                        files.push(file);
                        continue;
                    }

                    let testDir = file.directories.test;
                    if (!testDir) {
                        testDir = file.directory('test');
                    }
                    if (await testDir.exists()) {
                        let subEntries = await testDir.resolve('**/*.js');
                        list.push(...subEntries);
                    }
                }
            } else {
                let testDirs = [];
                let workspaces = await project.getWorkspaces();
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
                files = [];
                for (let i = 0; i < testDirs.length; i++) {
                    let directory = testDirs[i];
                    if (await directory.exists()) {
                        let subEntries = await directory.resolve('**/*.js');
                        files.push(...subEntries);
                    }
                }
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

            options.jsx = options.jsx != false ? {
                module: options['jsx.module'],
                pragma: options['jsx.pragma'],
                pragmaFrag: options['jsx.pragmaFrag'],
                pragmaDefault: options['jsx.pragmaDefault'],
            } : false;

            const { runners, exitCode } = await runTests(app, project, files, options, taskEnvironments);

            if (options.watch && !options.prepare) {
                const collectedFiles = [];
                let timeout;

                // start the watch task
                project.watch({
                    ignore: (file) => !filterChangedRunners(runners, [file]).length,
                }, async (eventType, file) => {
                    if (eventType === 'unlink') {
                        app.logger.info(`${file.path} removed`);
                    } else {
                        app.logger.info(`${project.relative(file)} changed`);
                    }

                    collectedFiles.push(file);
                    clearTimeout(timeout);

                    timeout = setTimeout(async () => {
                        const files = collectedFiles.slice(0);
                        collectedFiles.splice(0, collectedFiles.length);

                        const runnersWithChanges = filterChangedRunners(runners, files);
                        if (runnersWithChanges.length === 0) {
                            return true;
                        }

                        try {
                            await startRunners(app, runnersWithChanges, files, !options.run);
                        } catch (err) {
                            if (err) {
                                app.logger.error(err);
                            }
                        }
                    }, 200);
                });
                return;
            }

            return exitCode;
        });
};

async function startRunners(app, runners, files, prepare = true, run = true) {
    const coverageMap = require('istanbul-lib-coverage').createCoverageMap({});
    let finalExitCode = 0;

    for (let i = 0; i < runners.length; i++) {
        const runner = runners[i];
        if (prepare) {
            await runner.build(files);
        }
        if (run) {
            const { exitCode, coverage } = await runner.run(run);
            if (coverage) {
                coverageMap.merge(coverage);
            }
            if (exitCode !== 0) {
                finalExitCode = exitCode;
            }
        }
    }

    if (run) {
        app.logger.newline();
        const summary = coverageMap.getCoverageSummary();
        if (summary.data &&
            (summary.data.lines.pct !== 'Unknown' ||
                summary.data.statements.pct !== 'Unknown' ||
                summary.data.functions.pct !== 'Unknown' ||
                summary.data.branches.pct !== 'Unknown')) {
            printCoverageReport(app, summary);
        }
    }

    return { runners, coverage: coverageMap, exitCode: finalExitCode };
}

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
    let runners = [];
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
                if (options.prepare) {
                    app.logger.success(`${runner.name} ready`);
                }
            });
            runner.on(NodeTestRunner.STOP_EVENT, () => {
                app.logger.stop();
            });
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
                if (options.prepare) {
                    app.logger.success(`${runner.name} ready`);
                }
            });
            runner.on(BrowserTestRunner.STOP_EVENT, () => {
                app.logger.stop();
            });
        }
    }

    return startRunners(app, runners, files, !options.run, !options.prepare);
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
 * @param {Object} summary The report to print.
 * @return {void}
 */
function printCoverageReport(app, summary) {
    const colors = require('colors/safe');
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
    app.logger.newline();
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
