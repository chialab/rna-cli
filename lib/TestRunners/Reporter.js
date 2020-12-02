const colors = require('colors/safe');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { Test } = require('./Test');
const { Suite } = require('./Suite');

const symbols = {
    ok: '✓',
    err: '✖',
    dot: '․',
    comma: ',',
    bang: '!',
};

function printLine(summary, key) {
    let str = lineForKey(summary, key);
    let type = 'yellow';
    if (summary[key].pct > 80) {
        type = 'green';
    } else if (!isNaN(summary[key].pct) && summary[key].pct < 50) {
        type = 'red';
    }

    return colors[type](str);
}

function lineForKey(summary, key) {
    let metrics = summary[key];
    key = key.substring(0, 1).toUpperCase() + key.substring(1);
    if (key.length < 12) {
        key += '                   '.substring(0, 12 - key.length);
    }
    let result = `${key}: ${metrics.pct}% (${metrics.covered}/${metrics.total})`;
    let skipped = metrics.skipped;
    if (skipped > 0) {
        return `${result}, ${skipped} ignored`;
    }
    return result;
}

function printIndent(level, size = 2) {
    if (!level) {
        return '';
    }
    return ''.padStart(level * size, ' ');
}

function printIndented(message, level, size) {
    return message
        .trim()
        .replace(/^[ ]*/gm, printIndent(level, size));
}

function printTest(test, indent = 1) {
    let symbol = colors.grey(symbols.bang);
    if (test.isPassed()) {
        symbol = colors.green(symbols.ok);
    } else if (test.isFailed()) {
        symbol = colors.red(symbols.err);
    }

    return `${printIndent(indent)}${symbol} ${colors.grey(test.title)}`;
}

function printSuite(suite, indent = 0) {
    let output = `${printIndent(indent)}${colors.bold(suite.title)}`;
    if (suite.suites && suite.suites.length) {
        output += '\n';
        output += suite.suites
            .map((suite) => printSuite(suite, indent + 1))
            .join('\n');
    }


    if (suite.tests && suite.tests.length) {
        output += '\n';
        output += suite.tests
            .map((test) => printTest(test, indent + 1))
            .join('\n');
    }

    return output;
}

function showDiff(error) {
    return (error &&
        error.showDiff !== false &&
        Object.prototype.toString.call(error.actual) === Object.prototype.toString.call(error.expected) &&
        error.expected !== undefined
    );
}

function stringifyDiffObjs(error) {
    if (typeof error.actual !== 'string' || typeof error.expected !== 'string') {
        error.actual = JSON.stringify(error.actual);
        error.expected = JSON.stringify(error.expected);
    }
}

function errorDiff(actual, expected) {
    return require('diff')
        .diffWordsWithSpace(actual, expected)
        .map((str) => {
            if (str.added) {
                return colors.green(str.value);
            }
            if (str.removed) {
                return colors.red(str.value);
            }
            return str.value;
        })
        .join('');
}

function notBlank(line) {
    return typeof line !== 'undefined' && line !== null;
}

function unifiedDiff(actual, expected) {
    let msg = require('diff').createPatch('string', actual, expected);
    let lines = msg.split('\n').splice(5);
    return `${colors.green('+ expected')} ${colors.red('- actual')}

${lines
        .map((line) => {
            if (line[0] === '+') {
                return colors.green(line);
            }
            if (line[0] === '-') {
                return colors.red(line);
            }
            if (line.match(/@@/)) {
                return '--';
            }
            if (line.match(/\\ No newline/)) {
                return null;
            }

            return line;
        })
        .filter(notBlank)
        .join('\n')}`;
}

function inlineDiff(actual, expected) {
    let msg = errorDiff(actual, expected);

    // linenos
    let lines = msg.split('\n');
    if (lines.length > 4) {
        msg = lines
            .map((str, i) =>
                `| ${str}`.padStart(++i)
            )
            .join('\n');
    }

    return `${colors.red('actual')} ${colors.green('expected')}\n\n${msg}`;
}

function generateDiff(actual, expected) {
    try {
        return exports.inlineDiffs ?
            inlineDiff(actual, expected) :
            unifiedDiff(actual, expected);
    } catch (err) {
        return `${colors.green('+ expected')} ${colors.red('- actual:  failed to generate Mocha diff')}`;
    }
}

function getFullErrorMessage(error) {
    if (error.message && typeof error.message.toString === 'function') {
        return `${error.message}`;
    } else if (typeof error.inspect === 'function') {
        return `${error.inspect()}`;
    }

    return '';
}

function getErrorMessage(error) {
    let message = getFullErrorMessage(error);

    // uncaught
    if (error.uncaught) {
        message = `Uncaught ${message}`;
    }

    return message;
}

function getErrorStack(error) {
    let message = getFullErrorMessage(error);
    let stack = error.stack || message;
    if (stack === message) {
        return '';
    }

    return stack
        .trim()
        .replace(/^[ ]*/gm, '');
}

function printFailed(failed) {
    return failed.map((test) => {
        let envs = Object.keys(test.errors);
        let error = test.errors[envs[0]];
        let fullMessage = getFullErrorMessage(error);
        let errorMessage = getErrorMessage(error);

        // explicitly show diff
        if (showDiff(error)) {
            stringifyDiffObjs(error);
            let match = fullMessage.match(/^([^:]+): expected/);
            errorMessage = `${colors.red(match ? match[1] : errorMessage)}`;
            errorMessage += `\n${generateDiff(error.actual, error.expected)}`;
        }

        // indented test title
        let testTitle = '';
        let indent = 0;
        test.path.forEach((str, index) => {
            if (index !== 0) {
                indent++;
                testTitle += `\n${printIndent(indent)}`;
            }
            testTitle += str;
        });

        let output = `${colors.bold(testTitle)}\n${colors.red(printIndented(errorMessage, indent + 1))}\n`;

        if (envs.length > 1) {
            envs.forEach((env) => {
                output += `\n${printIndent(indent + 1)}${colors.yellow(env)}`;
                let error = test.errors[env];
                let stack = getErrorStack(error);
                if (stack) {
                    output += `\n${colors.grey(printIndented(stack, indent + 1))}\n`;
                }
            });
        } else {
            let stack = getErrorStack(error);
            if (stack) {
                output += `\n${colors.grey(printIndented(stack, indent + 1))}\n`;
            }
        }

        return output;
    }).join('\n');
}

function printSummary(report) {
    return `${colors.bold('Summary')}
${colors.green(`${symbols.ok} ${report.passed.length} completed`)}
${colors[report.failed.length ? 'red' : 'grey'](`${symbols.err} ${report.failed.length} failed`)}
${colors.grey(`${symbols.bang} ${report.skipped.length} skipped`)}`;
}

function isEmptyCoverage(coverage) {
    let summary = coverage.getCoverageSummary();
    return !summary.data ||
        summary.data.lines.pct === 'Unknown' ||
        summary.data.statements.pct === 'Unknown' ||
        summary.data.functions.pct === 'Unknown' ||
        summary.data.branches.pct === 'Unknown';
}

function formatCoverage(coverage) {
    let summary = coverage.getCoverageSummary();
    let output = `${colors.bold('Coverage')}\n`;
    output += `${printLine(summary, 'statements')}\n`;
    output += `${printLine(summary, 'branches')}\n`;
    output += `${printLine(summary, 'functions')}\n`;
    output += printLine(summary, 'lines');

    return output;
}

function formatReport(report) {
    let output = report.suite.suites.map((suite) => printSuite(suite)).join('\n');
    if (output) {
        output += '\n';
    }

    output += report.suite.tests.map((test) => printTest(test)).join('\n');
    if (output) {
        output += '\n';
    }

    if (report.failed && report.failed.length) {
        let failed = report.failed
            .reduce((list, test) => {
                if (list.indexOf(test) === -1) {
                    list.push(test);
                }
                return list;
            }, []);
        output += '\n';
        output += printFailed(failed);
        output += '\n';
    }

    if (output) {
        output += '\n';
    }
    output += printSummary(report);

    if (report.logs && report.logs.length) {
        if (output) {
            output += '\n';
        }

        output += '\n';
        output += report.logs.join('\n');
        output += '\n';
    }

    if (output) {
        output += '\n';
    }

    let coverageMap = createCoverageMap(report.coverage);
    if (!isEmptyCoverage(coverageMap)) {
        output += '\n';
        output += formatCoverage(coverageMap);
        output += '\n';
    }

    return output;
}

class Reporter {
    constructor(name) {
        this.name = name;
        this.suite = new Suite();
        this.skipped = [];
        this.passed = [];
        this.failed = [];
        this.logs = [];
        this.coverageMap = createCoverageMap({});
    }

    add(test) {
        return this.suite.add(test);
    }

    log(message) {
        this.logs.push(message);
    }

    skip(test) {
        if (test instanceof Test) {
            test = this.suite.find(test.path) || this.suite.add(test);
        } else {
            test = this.suite.find(test) || this.suite.add(test);
        }

        this.skipped.push(test);
        return test;
    }

    pass(test) {
        if (test instanceof Test) {
            test = this.suite.find(test.path) || this.suite.add(test);
        } else {
            test = this.suite.find(test) || this.suite.add(test);
        }

        test.pass();
        this.passed.push(test);
        return test;
    }

    fail(test, error, key) {
        if (test instanceof Test) {
            test = this.suite.find(test.path) || this.suite.add(test);
        } else {
            test = this.suite.find(test) || this.suite.add(test);
        }

        test.fail(error, key || this.name);
        this.failed.push(test);
        return test;
    }

    mergeCoverage(coverage) {
        this.coverageMap.merge(coverage);
    }

    getReport() {
        return {
            suite: this.suite,
            skipped: this.skipped.slice(0),
            passed: this.passed.slice(0),
            failed: this.failed.slice(0),
            logs: this.logs.slice(0),
            coverage: this.coverageMap.toJSON(),
        };
    }

    merge(report) {
        let addTests = (suite) => {
            if (suite.suites) {
                suite.suites.forEach((suite) => addTests(suite));
            }
            if (suite.tests) {
                suite.tests.forEach((test) => this.add(test.path));
            }
        };
        addTests(report.suite);
        report.skipped.forEach((test) => this.skip(test));
        report.passed.forEach((test) => this.pass(test));
        report.failed.forEach((test) => {
            Object.keys(test.errors).forEach((key) => {
                this.fail(test, test.errors[key], key);
            });
        });
        report.logs.forEach((message) => this.log(message));
        this.coverageMap.merge(report.coverage);
    }
}

module.exports.formatReport = formatReport;
module.exports.Reporter = Reporter;
