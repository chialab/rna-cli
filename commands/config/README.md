Set rna cli configuration.

Configurations are stored differently based on your os:

* Mac OS and Linux: `~/.config/@chialab/rna-cli/store.json`
* Windows: `%APPDATA%/@chialab/rna-cli/store.json`

### Usage
```sh
# Add a config value using key
$ rna config <key> <value>

# The configuration key can be a path.
# For example, you can set the saucelabs username via:
$ rna config 'saucelabs.username' '...'

# In order to remove a value, use the `null` value:
$ rna config 'saucelabs.username' null

# You can set an object using JSON:
$ rna config 'saucelabs' '{ "username": "..." }'
```
