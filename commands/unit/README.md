# Command: `unit`

## Options
* `--targets` Set specific targets for the build using a [Browserslist](https://github.com/browserslist/browserslist). This query is used by Babel and postCSS to transpile JavaScript and CSS files in order to be compatible with the specified browsers. Use `--no-targets` to prevent code transpiling.
* `--node` Run tests in node context.
* `--browser` Run tests in browser context.
* `--saucelabs` Use SauceLabs as browsers provider.
* `--electron` Run tests in Electron context.
* `--nativescript <ios|android>` Run tests in Nativescript context.
* `--coverage` Generate a code coverage report.
* `--concurrency` Set concurrency level for tests.
* `--context` Use a specific HTML document for tests.
* `--timeout` Set the tests timeout.
* `--watch` Watch test files.

### Run tests on SauceLabs

You can use [SauceLabs](https://saucelabs.com/) to run the tests in the cloud, on multiple browsers. In order to connect with SauceLabs, you need to set the `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` variables with your account data.

### See also

* [`rna build`](../build/)
