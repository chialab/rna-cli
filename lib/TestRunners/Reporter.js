const colors = require('colors/safe');
const Mocha = require('mocha');
const {
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_SUITE_BEGIN,
} = Mocha.Runner.constants;
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createSourceMapStore } = require('istanbul-lib-source-maps');
const { createContext, getDefaultWatermarks } = require('istanbul-lib-report');
const { create: createReporter } = require('istanbul-reports');

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
    return ''.padStart(level * size, ' ');
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

function printSuite(suite, indent = 1) {
    let output = '';
    if (suite.title) {
        output += `${printIndent(indent)}${colors.bold(suite.title)}`;
    }

    if (suite.suites && suite.suites.length) {
        if (suite.title) {
            output += '\n';
        }
        output += suite.suites
            .map((suite) => printSuite(suite, indent + 1))
            .join('\n');
    }


    if (suite.tests && suite.tests.length) {
        if ((suite.suites && suite.suites.length) || suite.title) {
            output += '\n';
        }
        output += suite.tests
            .map((test) => printTest(test, indent + 1))
            .join('\n');
    }

    return output;
}

function sameType(a, b) {
    return Object.prototype.toString.call(a) === Object.prototype.toString.call(b);
}

function showDiff(err) {
    return (err &&
        err.showDiff !== false &&
        sameType(err.actual, err.expected) &&
        err.expected !== undefined
    );
}

function stringifyDiffObjs(err) {
    if (typeof err.actual !== 'string' || typeof err.expected !== 'string') {
        err.actual = JSON.stringify(err.actual);
        err.expected = JSON.stringify(err.expected);
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
    let indent = '      ';
    function cleanUp(line) {
        if (line[0] === '+') {
            return indent + colors.green(line);
        }
        if (line[0] === '-') {
            return indent + colors.red(line);
        }
        if (line.match(/@@/)) {
            return '--';
        }
        if (line.match(/\\ No newline/)) {
            return null;
        }

        return indent + line;
    }

    let msg = require('diff').createPatch('string', actual, expected);
    let lines = msg.split('\n').splice(5);
    return `
      ${colors.green('+ expected')} ${colors.red('- actual')}

${lines
        .map(cleanUp)
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

    // legend
    msg = `
${colors.red('actual')} ${colors.green('expected')}

${msg}
`;

    // indent
    msg = msg.replace(/^/gm, '      ');
    return msg;
}

function generateDiff(actual, expected) {
    try {
        return exports.inlineDiffs ?
            inlineDiff(actual, expected) :
            unifiedDiff(actual, expected);
    } catch (err) {
        return `
      ${colors.green('+ expected')} ${colors.red('- actual:  failed to generate Mocha diff')}
`;
    }
}

function printFailures(failures) {
    let multipleTest, multipleErr;

    return  failures.map((test) => {
        let msg, err;
        if (test.err && test.err.multiple) {
            if (multipleTest !== test) {
                multipleTest = test;
                multipleErr = [test.err].concat(test.err.multiple);
            }
            err = multipleErr.shift();
        } else {
            err = test.err;
        }

        let message;
        if (err.message && typeof err.message.toString === 'function') {
            message = `${err.message}`;
        } else if (typeof err.inspect === 'function') {
            message = `${err.inspect()}`;
        } else {
            message = '';
        }

        let stack = err.stack || message;
        let index = message ? stack.indexOf(message) : -1;

        if (index === -1) {
            msg = message;
        } else {
            index += message.length;
            msg = stack.slice(0, index);
            // remove msg from stack
            stack = stack.slice(index + 1);
        }

        // uncaught
        if (err.uncaught) {
            msg = `Uncaught ${msg}`;
        }

        // explicitly show diff
        if (showDiff(err)) {
            stringifyDiffObjs(err);
            let match = message.match(/^([^:]+): expected/);
            msg = `\n      ${colors.red(match ? match[1] : msg)}`;
            msg += generateDiff(err.actual, err.expected);
        }

        // indented test title
        let testTitle = '';
        let indent = 0;
        test.titlePath().forEach((str, index) => {
            if (index !== 0) {
                indent++;
                testTitle += `\n${printIndent(indent)}`;
            }
            testTitle += str;
        });

        return `${colors.bold(colors.red(testTitle))}
${printIndent(indent + 1)}${colors.red(msg)}
${colors.grey(stack.replace(/^\s*/gm, printIndent(indent + 2)))}`;
    }).join('\n\n');
}

class Reporter {
    static formatReport(report) {
        let output = '';

        report.suites.forEach((suite) => {
            if (!suite.title) {
                output += printSuite(suite);
            }
        });

        if (report.failures && report.failures.length) {
            if (output) {
                output += '\n\n';
            }
            output += printFailures(report.failures);
        }

        return output;
    }

    static formatCoverage(coverage) {
        let summary = coverage.getCoverageSummary();
        let output = `${colors.underline('COVERAGE:')}\n`;
        output += `${printLine(summary, 'statements')}\n`;
        output += `${printLine(summary, 'branches')}\n`;
        output += `${printLine(summary, 'functions')}\n`;
        output += printLine(summary, 'lines');

        return output;
    }

    static isEmptyCoverage(coverage) {
        let summary = coverage.getCoverageSummary();
        return !summary.data ||
            summary.data.lines.pct === 'Unknown' ||
            summary.data.statements.pct === 'Unknown' ||
            summary.data.functions.pct === 'Unknown' ||
            summary.data.branches.pct === 'Unknown';
    }

    constructor(runner, options) {
        this.runner = runner;
        this.options = options;

        this.suites = [];
        this.passes = [];
        this.failures = [];
        this.coverageMap = createCoverageMap({});

        runner.on(EVENT_SUITE_BEGIN, (suite) => {
            this.suites.push(suite);
        });

        runner.on(EVENT_TEST_PASS, (test) => {
            this.passes.push(test);
        });

        runner.on(EVENT_TEST_FAIL, (test, err) => {
            stringifyDiffObjs(err);
            // more than one error per test
            if (test.err && err instanceof Error) {
                test.err.multiple = (test.err.multiple || []).concat(err);
            } else {
                test.err = err;
            }

            this.failures.push(test);
        });
    }

    async addCoverage(coverageReport, environment) {
        this.coverageMap.merge(coverageReport);
        let coverageMap = createCoverageMap(coverageReport);
        let remappedCoverageMap = await createSourceMapStore().transformCoverage(coverageMap);
        let reportDir = this.coverageDir.directory(environment);
        let context = createContext({
            dir: reportDir.path,
            watermarks: getDefaultWatermarks(),
            coverageMap: remappedCoverageMap,
        });
        createReporter('html').execute(context);
        createReporter('lcovonly').execute(context);
    }

    getReport() {
        return {
            suites: this.suites,
            passes: this.passes,
            failures: this.failures,
            coverage: this.coverageMap.toJSON(),
        };
    }

    done(failures, done) {
        done(failures, this);
    }
}

module.exports = Reporter;
