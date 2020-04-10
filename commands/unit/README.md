# Command: `unit`

Run unit and e2e tests in Node and Browser environments, using [Mocha](https://mochajs.org/) as test framework and [Chai](https://www.chaijs.com/) as assertion library. Tests in the browsers are launched by [Karma](https://karma-runner.github.io).

## Options
* `--targets <string>` Set specific targets for the build using a [Browserslist](https://github.com/browserslist/browserslist). This query is used by Babel and postCSS to transpile JavaScript and CSS files in order to be compatible with the specified browsers. Use `--no-targets` to prevent code transpiling.
* `--node` Run tests in node context.
* `--browser [browserName]` Run tests in browser context. If no browser is specified, it runs on all browsers installed.
* `--saucelabs` Use SauceLabs as browsers provider.
* `--coverage` Generate a code coverage report.
* `--concurrency <number>` Set concurrency level for tests.
* `--context <path>` Use a specific HTML document for tests.
* `--headless` Run browsers in headless mode.
* `--loglevel <DISABLE|INFO|DEBUG|WARN|ERROR>` Log level for tests.
* `--prepare` Prepare tests build but skip run.
* `--run` Skip tests build.
* `--timeout <number>` Set the tests timeout.
* `--watch` Watch test files.

### Run tests on SauceLabs

You can use [SauceLabs](https://saucelabs.com/) to run the tests in the cloud, on multiple browsers. In order to connect with SauceLabs, you need to set the `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` variables with your account data.

### See also

* [`rna build`](../build/)
