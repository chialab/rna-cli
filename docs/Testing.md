RNA provides the `test` command to run tests in browsers and Node environments, using [Mocha](https://mochajs.org/) as test framework, [Chai](https://www.chaijs.com/) as assertion library and [Karma](http://karma-runner.github.io) as test runner for browsers.

## Write a test

Each test file is bundled with the tested library or WebApp, so you can use the ES6 `import` statement to load the source to test. Source maps for source code are provided by default.

**test/math.spec.js**
```js
import { sum } '../src/math.js';

describe('method sum', () => {
  it('should perform a simple sum', () => {
    expect(sum(1, 1)).to.be.equal(2);
  });
});
```

Since the bundler script is the same used to [build the source code](./Build-js-modules), you can use `async`/`await` for deferred tests, JSX or TypeScript syntaxex and assets loading in your test files.

## Run

Once you have wrote a test file, you can run the suite in browser, cloud browsers and Node instances. When no environment has been specified, RNA will run against Node and all installed browsers.

### Browser

Running `$ rna test test/*.spec.js --browser` RNA will lookup in your machine for installed browsers to launch. Supported browsers are `chrome`, `firefox`, `edge`, `ie`, `safari` and `opera`. You can specify a single browser to run (`--browser chrome`) or a subset of the available (`--browser edge,firefox`).

Every test is launched with a clean profile, so cookies are not stored permanently and extensions are not loaded, also when using the watch mode (`--watch`).

### Node

To test Node environments, run the `$ rna test test/*.spec.js --node` command.

### Cloud

In order to run tests in the SauceLabs cloud, please [read this article](./Testing-with-SauceLabs).

## Coverage reports

Adding the `--coverage` flag to the `test` command, RNA will produce coverage reports in the `coverage` directory. Code coverage is provided by the [Istanbul](https://istanbul.js.org/) library in HTML and `lcov` formats, so you can monitor the coverage of a PR or the global state of the project using integrations like [Codecov](https://codecov.io/).
