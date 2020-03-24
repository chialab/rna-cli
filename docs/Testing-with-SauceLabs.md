RNA provides all the necessary to launch unit tests on [Saucelabs](https://saucelabs.com/), an ondemand VMs provider for Selenium and Appium testing.

## Configuration

First of all, you need to set 2 environment variables:
```sh
$ export SAUCE_USERNAME=<your saucelabs username>
$ export SAUCE_ACCESS_KEY=<your saucelabs access token>
```
RNA will use those variables to log into the SauceLabs cloud and run tests.

You can also set global configuration for RNA:
```sh
$ rna config set saucelabs.username <your saucelabs username>
$ rna config set saucelabs.accessKey <your saucelabs access token>
```

## Selecting VMs

RNA is able to convert [browserslist](https://github.com/ai/browserslist) queries to SauceLabs VMs configurations. By default, the CLI will use the following default query:
```json
[
    "ie >= 11",
    "last 3 iOS major versions",
    "Android >= 4.4",
    "last 3 Safari major versions",
    "last 3 Firefox major versions",
    "unreleased Firefox versions",
    "Chrome 45",
    "last 3 Chrome major versions",
    "unreleased Chrome versions",
    "last 3 Edge major versions"
]
```
unless a different query is specified through the `--targets <query>` flag.

A list of supported queries can be found [here](https://github.com/ai/browserslist#queries).

## Unit testing

In order to launch **unit** tests in SauceLabs, run:
```sh
$ rna unit <path-to-tests> --saucelabs [--targets <query>]
```
This will setup a [Karma](https://karma-runner.github.io)'s server and a tunnel between SauceLabs and your local environment. Then, it will run tests for the selected VMs.
