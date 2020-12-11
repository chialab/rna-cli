/**
 * Register command to CLI.
 *
 * @param {Command} program Command.
 * @returns {void}
 */
module.exports = (program) => {
    program
        .command('test')
        .alias('unit')
        .description('Run project tests.')
        .readme(`${__dirname}/README.md`)
        .option('[--targets <string>]', 'A supported browserslist query.')
        .option('[--node]', 'Run tests in node context.')
        .option('[--browsers [browserName]]', 'Run tests in browser context.')
        .option('[--saucelabs]', 'Use SauceLabs as browsers provider.')
        .option('[--coverage]', 'Generate a code coverage report.')
        .option('[--concurrency <number>]', 'Set concurrency level for tests.')
        .option('[--context <path>]', 'Use a specific HTML document for tests.')
        .option('[--headless]', 'Run browsers in headless mode.')
        .option('[--prepare]', 'Prepare tests build but skip run.')
        .option('[--run]', 'Skip tests build.')
        .option('[--timeout <number>]', 'Set the tests timeout.')
        .option('[--watch]', 'Watch test files.')
        .action(async (app, options = {}) => {
            const { Project } = require('../../lib/File');

            const cwd = process.cwd();
            const project = await Project.init(cwd);

            if (options.browser) {
                app.logger.warn('--browser option has been deprecated, use --browsers');
                options.browsers = options.browser;
            }

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

            if (options.prepare) {
                delete options.run;
                delete options.watch;
                app.logger.warn('--prepare mode, specs will not run');
            }
            if (options.run) {
                delete options.watch;
                app.logger.warn('--run mode, skipping specs build');
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
                app.logger.warn('no test specs found.');
                return;
            }

            let environments = [
                options.node && 'node',
                options.browsers && 'browser',
                options.saucelabs && 'saucelabs',
            ].filter(Boolean);
            if (!environments.length) {
                // If test environment is not provide, use `browser` as default.
                environments.push('node', 'browser');
                options.node = true;
                options.browsers = true;
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

            let runners = await getRunners(app, project, files, options, environments);
            let result = await runTests(app, project, runners, files, !options.run, !options.prepare);

            if (options.watch && !options.prepare) {
                let collectedFiles = [];
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
                            await runTests(app, project, runnersWithChanges, files, !options.run);
                        } catch (err) {
                            //
                        }
                    }, 200);
                });
                return;
            }

            if (result.reporter.failed.length) {
                return 1;
            }

            return result;
        });
};

function runTest(project, runner, files, prepare, run, reports = []) {
    const Listr = require('listr');
    const TestRunner = require('../../lib/TestRunners/TestRunner');
    const { Observable } = require('rxjs');

    let root = project.parent || project;
    let tasks = [];
    let prepareSpecsTask, prepareRunnerTask, runPromise;
    let prepareSpecsObserver = new Observable(async (observer) => {
        runner.on(TestRunner.PREPARE_START_EVENT, () => {
            observer.next('building specs...');
        });

        runner.on(TestRunner.PREPARE_PROGRESS_EVENT, (file) => {
            observer.next(`building ${root.relative(file)}...`);
        });

        runner.on(TestRunner.PREPARE_END_EVENT, () => {
            prepareSpecsTask.output = '';
            observer.complete();
        });

        runner.build(files)
            .catch((err) => observer.error(err));
    });

    let prepareRunnerObserver = new Observable((observer) => {
        runner.on(TestRunner.RUN_START_EVENT, (reporters) => {
            tasks = reporters.map((reporter) => {
                let runTask;

                let runObserver = new Observable(async (observer) => {
                    observer.next('setting up tests...');
                    runTask.title = reporter.name;

                    runner.on(TestRunner.RUN_PROGRESS_EVENT, (reporterInstance, title) => {
                        if (reporter === reporterInstance) {
                            runTask.title = reporter.name;
                            observer.next(`running ${title}...`);
                        }
                    });

                    runner.on(TestRunner.RUN_END_EVENT, () => {
                        runTask.title = reporter.name;
                        if (reporter.getReport().failed.length) {
                            observer.error({ message: '' });
                            runTask.output = '';
                        } else {
                            runTask.output = '';
                            observer.complete();
                        }
                    });

                    runPromise
                        .catch((err) => observer.error(err));
                });

                return {
                    title: reporter.name,
                    task: (ctx, task) => {
                        runTask = task;
                        return runObserver;
                    },
                };
            });

            prepareRunnerTask.output = '';
            observer.complete();
        });

        runPromise = runner.run(run);
        runPromise
            .then((reporter) => {
                reports.push(reporter.getReport());
                observer.complete();
            })
            .catch((err) => observer.error(err));
    });

    return {
        title: `${runner.name} runner`,
        task: () => new Listr([
            {
                title: 'prepare specs',
                skip: () => !prepare,
                task: (ctx, task) => {
                    prepareSpecsTask = task;
                    return prepareSpecsObserver;
                },
            },
            {
                title: 'prepare runner',
                skip: () => !run,
                task: (ctx, task) => {
                    prepareRunnerTask = task;
                    return prepareRunnerObserver;
                },
            },
            {
                title: 'run',
                skip: () => !run,
                task: () => new Listr(tasks, {
                    exitOnError: false,
                    concurrent: true,
                }),
            },
        ]),
    };
}

async function runTests(app, project, runners, files, prepare = true, run = true) {
    const Listr = require('listr');
    const Renderer = require('../../lib/Cli/renderer');
    const VerboseRenderer = require('listr-verbose-renderer');
    const { formatReport, Reporter } = require('../../lib/TestRunners/Reporter');

    let reports = [];
    let list = new Listr(runners.map((runner) => runTest(project, runner, files, prepare, run, reports)), {
        concurrent: true,
        renderer: process.stdout.isTTY ? Renderer : VerboseRenderer,
    });

    try {
        await list.run();
    } catch (err) {
        if (err && err.toString().indexOf('ListrError') === 0) {
            let errors = err.errors;
            let error = errors.find((err) => err.message);
            if (error) {
                throw error;
            }
        } else {
            throw err;
        }
    }

    let reporter = new Reporter();
    reports.forEach((report) => {
        reporter.merge(report);
    });

    if (run) {
        app.logger.newline();
        app.logger.log(formatReport(reporter.getReport()));
    }

    return { runners, reporter };
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
async function getRunners(app, project, files, options, environments = []) {
    let runners = [];
    // Test built sources.
    for (let i = 0; i < environments.length; i++) {
        let taskEnvName = environments[i];

        if (taskEnvName === 'node') {
            // Startup Mocha.
            const NodeTestRunner = require('../../lib/TestRunners/NodeTestRunner');
            let runner = new NodeTestRunner();
            await runner.setup(options);
            runners.push(runner);
        } else if (taskEnvName === 'browser') {
            const BrowserTestRunner = require('../../lib/TestRunners/BrowserTestRunner');
            let runner = new BrowserTestRunner();
            await runner.setup(options);
            runners.push(runner);
        } else if (taskEnvName === 'saucelabs') {
            const SaucelabsTestRunner = require('../../lib/TestRunners/SaucelabsTestRunner');
            let runner = new SaucelabsTestRunner();
            await runner.setup({
                ...options,
                browsers: typeof options.saucelabs === 'string' ? options.saucelabs : undefined,
            });
            runners.push(runner);
        }
    }

    return runners;
}

function filterChangedRunners(runners, files) {
    return runners
        .filter((runner) => {
            let runnerFiles = runner.files || [];
            return files.some((file) => runnerFiles.includes(file.path));
        });
}
